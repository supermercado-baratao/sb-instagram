import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'

import BetterSqlite3 from 'better-sqlite3'
import { count } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { Zip, ZipDeflate } from 'fflate'

import {
  BACKUP_DATA_ENTRIES,
  BACKUP_DATABASE_NAME,
  BACKUP_MANIFEST_NAME,
  BACKUP_VERSION,
  type BackupManifest,
  type BackupSummary,
  createBackupManifest,
  getBackupFileEntryName,
  getBackupFilePath,
  isBackupManifest
} from '@/domain/backup'
import { isUuid } from '@/domain/uuid'
import { dataDirectory as defaultDataDirectory } from '@/infra/data-directory'
import { migrationsFolder as defaultMigrationsFolder } from '@/infra/database/file'
import { type Database, relations } from '@/infra/database/relations'
import {
  brand,
  generations,
  offerPageItems,
  offerPages,
  products,
  pronunciations
} from '@/infra/database/schema'
import { extractZip } from '@/infra/zip'

// The instance's own connection, since a backup reads and replaces the whole file
type ClientDatabase = Database & { $client: BetterSqlite3.Database }

type BackupOptions = { dataDirectory?: string; migrationsFolder?: string }

export class BackupError extends Error {}

const EXPORT_PREFIX = '.backup-'
const RESTORE_PREFIX = '.restore-'
const RESTORE_FILES_FOLDER = 'files'
const RESTORE_OLD_FOLDER = 'old'
const MIGRATIONS_TABLE = '__drizzle_migrations'
const INVALID_BACKUP_MESSAGE =
  'O arquivo não é um backup do app. Escolha o arquivo .zip baixado em "Baixar backup".'

const getRestoreFolder = (dataDirectory: string, token: string) => {
  if (!isUuid(token)) throw new BackupError('Backup não encontrado.')
  return path.join(dataDirectory, `${RESTORE_PREFIX}${token}`)
}

const exists = async (file: string) => {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

// Temporary names start with a dot, like the generations' own, so neither a backup nor a restore
// takes them
const listFiles = async (folder: string, prefix = ''): Promise<string[]> => {
  const entries = await readdir(folder, { withFileTypes: true })
  const files = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.'))
      .map(async (entry) => {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          return listFiles(path.join(folder, entry.name), relative)
        }
        return entry.isFile() ? [relative] : []
      })
  )
  return files.flat().toSorted((a, b) => a.localeCompare(b))
}

const listDataFiles = async (dataDirectory: string) => {
  const files: string[] = []
  for (const entry of BACKUP_DATA_ENTRIES) {
    const entryPath = path.join(dataDirectory, entry)
    let entryStat
    try {
      entryStat = await stat(entryPath)
    } catch {
      continue
    }
    if (entryStat.isFile()) files.push(entry)
    else if (entryStat.isDirectory()) {
      files.push(...(await listFiles(entryPath, entry)))
    }
  }
  return files
}

const countRows = (database: Database, table: SQLiteTable) =>
  database.select({ count: count() }).from(table).get()?.count ?? 0

export const summarizeDatabase = (database: Database): BackupSummary => ({
  brandName:
    database.select({ name: brand.name }).from(brand).get()?.name ?? null,
  productCount: countRows(database, products),
  offerPageCount: countRows(database, offerPages),
  offerProductCount: countRows(database, offerPageItems),
  generationCount: countRows(database, generations),
  pronunciationCount: countRows(database, pronunciations)
})

// The archive is read one file at a time as the response asks for it, so a store with years of
// generations never holds the whole backup in memory. Deflate frames every entry, so the streaming
// reader on import finds where each one ends without the central directory
export async function* createBackupArchive(
  database: ClientDatabase,
  { dataDirectory = defaultDataDirectory }: BackupOptions = {}
): AsyncGenerator<Uint8Array> {
  const folder = path.join(dataDirectory, `${EXPORT_PREFIX}${randomUUID()}`)
  await mkdir(folder, { recursive: true })
  try {
    const snapshot = path.join(folder, BACKUP_DATABASE_NAME)
    // A consistent copy while the app keeps running (https://sqlite.org/lang_vacuum.html#vacuuminto)
    database.$client.prepare('VACUUM INTO ?').run(snapshot)

    const chunks: Uint8Array[] = []
    let failure: Error | undefined
    const zip = new Zip((error, chunk) => {
      if (error) failure = error
      else chunks.push(chunk)
    })
    const add = (name: string, data: Uint8Array, level: 0 | 6) => {
      const file = new ZipDeflate(name, { level })
      zip.add(file)
      file.push(data, true)
      if (failure) throw failure
    }
    const flush = function* () {
      yield* chunks.splice(0)
    }

    const manifest = JSON.stringify(createBackupManifest(new Date()), null, 2)
    add(BACKUP_MANIFEST_NAME, new TextEncoder().encode(manifest), 6)
    add(BACKUP_DATABASE_NAME, await readFile(snapshot), 6)
    await rm(snapshot)
    yield* flush()

    const files = await listDataFiles(dataDirectory)
    for (const file of files) {
      let data
      try {
        data = await readFile(path.join(dataDirectory, file))
      } catch {
        // Deleted while the backup ran
        continue
      }
      // Photos and generations are PNG and PDF, already compressed
      add(getBackupFileEntryName(file), data, 0)
      yield* flush()
    }

    zip.end()
    if (failure) throw failure
    yield* flush()
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
}

const getExtractTarget = (name: string) => {
  if (name === BACKUP_MANIFEST_NAME || name === BACKUP_DATABASE_NAME) {
    return [name]
  }
  const segments = getBackupFilePath(name)
  return segments && [RESTORE_FILES_FOLDER, ...segments]
}

const extractArchive = async (
  archive: AsyncIterable<Uint8Array>,
  folder: string
) => {
  let names: Set<string>
  try {
    names = await extractZip(archive, folder, getExtractTarget)
  } catch {
    throw new BackupError(INVALID_BACKUP_MESSAGE)
  }
  if (!names.has(BACKUP_DATABASE_NAME)) {
    throw new BackupError(INVALID_BACKUP_MESSAGE)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(
      await readFile(path.join(folder, BACKUP_MANIFEST_NAME), 'utf8')
    )
  } catch {
    throw new BackupError(INVALID_BACKUP_MESSAGE)
  }
  if (!isBackupManifest(parsed)) throw new BackupError(INVALID_BACKUP_MESSAGE)
  return parsed
}

const NEWER_VERSION_MESSAGE =
  'Este backup foi feito numa versão mais nova do app. Atualize o app antes de restaurá-lo.'

const listAppliedMigrations = (sqlite: BetterSqlite3.Database) => {
  const table = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(MIGRATIONS_TABLE)
  if (!table) throw new BackupError(INVALID_BACKUP_MESSAGE)
  return (
    sqlite.prepare(`SELECT name FROM "${MIGRATIONS_TABLE}"`).all() as {
      name: string | null
    }[]
  ).map(({ name }) => name)
}

// A backup from an older version goes through the same migrations an instance runs on startup, so
// its tables match the instance's before anything is copied
const prepareDatabase = async (file: string, migrationsFolder: string) => {
  let sqlite: BetterSqlite3.Database | undefined
  try {
    sqlite = new BetterSqlite3(file, { fileMustExist: true })
    sqlite.pragma('foreign_keys = ON')
    const known = new Set(await readdir(migrationsFolder))
    if (
      listAppliedMigrations(sqlite).some((name) => !name || !known.has(name))
    ) {
      throw new BackupError(NEWER_VERSION_MESSAGE)
    }
    const database = drizzle({ client: sqlite, relations })
    migrate(database, { migrationsFolder })
    return summarizeDatabase(database)
  } catch (error) {
    if (error instanceof BackupError) throw error
    throw new BackupError(INVALID_BACKUP_MESSAGE)
  } finally {
    sqlite?.close()
  }
}

export type PreparedBackup = {
  token: string
  manifest: BackupManifest
  summary: BackupSummary
}

// Nothing changes until applyBackup: the file is only extracted and checked, so the store sees what
// it replaces first
export const prepareBackup = async (
  archive: AsyncIterable<Uint8Array>,
  {
    dataDirectory = defaultDataDirectory,
    migrationsFolder = defaultMigrationsFolder
  }: BackupOptions = {}
): Promise<PreparedBackup> => {
  const token = randomUUID()
  const folder = getRestoreFolder(dataDirectory, token)
  await mkdir(folder, { recursive: true })
  try {
    const manifest = await extractArchive(archive, folder)
    if (manifest.version > BACKUP_VERSION) {
      throw new BackupError(NEWER_VERSION_MESSAGE)
    }
    const summary = await prepareDatabase(
      path.join(folder, BACKUP_DATABASE_NAME),
      migrationsFolder
    )
    return { token, manifest, summary }
  } catch (error) {
    await rm(folder, { recursive: true, force: true })
    throw error
  }
}

export const discardBackup = async (
  token: string,
  { dataDirectory = defaultDataDirectory }: BackupOptions = {}
) =>
  rm(getRestoreFolder(dataDirectory, token), { recursive: true, force: true })

const listTables = (sqlite: BetterSqlite3.Database, schema: string) =>
  (
    sqlite
      .prepare(
        `SELECT name FROM "${schema}".sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> ?`
      )
      .all(MIGRATIONS_TABLE) as { name: string }[]
  ).map(({ name }) => name)

const listColumns = (
  sqlite: BetterSqlite3.Database,
  schema: string,
  table: string
) =>
  (
    sqlite.prepare(`PRAGMA "${schema}".table_info("${table}")`).all() as {
      name: string
    }[]
  ).map(({ name }) => `"${name}"`)

const getSequence = (sqlite: BetterSqlite3.Database, table: string) =>
  (
    sqlite
      .prepare(`SELECT seq FROM sqlite_sequence WHERE name = ?`)
      .get(table) as { seq: number } | undefined
  )?.seq ?? 0

// Generation files are cached as immutable by id (AUTOINCREMENT never reuses one), so the restored
// generations take ids past every one this instance has used, or a browser would keep showing the
// files of the generation that had the same id before
const renumberGenerations = async (
  sqlite: BetterSqlite3.Database,
  backupFile: string,
  filesFolder: string
) => {
  const backup = new BetterSqlite3(backupFile, { fileMustExist: true })
  try {
    const ids = (
      backup.prepare(`SELECT id FROM generations ORDER BY id`).all() as {
        id: number
      }[]
    ).map(({ id }) => id)
    if (ids.length === 0) return
    const offset = Math.max(getSequence(sqlite, 'generations'), ...ids)
    backup.prepare(`UPDATE generations SET id = id + ?`).run(offset)
    const folder = path.join(filesFolder, 'generations')
    for (const id of ids) {
      const source = path.join(folder, String(id))
      if (await exists(source)) {
        await rename(source, path.join(folder, String(id + offset)))
      }
    }
  } finally {
    backup.close()
  }
}

const copyDatabase = (sqlite: BetterSqlite3.Database, backupFile: string) => {
  const sequence = getSequence(sqlite, 'generations')
  sqlite.prepare(`ATTACH DATABASE ? AS backup`).run(backupFile)
  try {
    const tables = listTables(sqlite, 'main')
    const backupTables = new Set(listTables(sqlite, 'backup'))
    if (
      tables.length !== backupTables.size ||
      tables.some((table) => !backupTables.has(table))
    ) {
      throw new BackupError(INVALID_BACKUP_MESSAGE)
    }
    sqlite.transaction(() => {
      // PRAGMA foreign_keys is a no-op inside a transaction, so the checks wait for the commit
      // instead (https://sqlite.org/pragma.html#pragma_defer_foreign_keys)
      sqlite.pragma('defer_foreign_keys = ON')
      for (const table of tables) sqlite.exec(`DELETE FROM main."${table}"`)
      for (const table of tables) {
        const columns = listColumns(sqlite, 'main', table).join(', ')
        sqlite.exec(
          `INSERT INTO main."${table}" (${columns}) SELECT ${columns} FROM backup."${table}"`
        )
      }
      const maxId =
        (
          sqlite.prepare(`SELECT max(id) AS id FROM generations`).get() as {
            id: number | null
          }
        ).id ?? 0
      sqlite
        .prepare(`DELETE FROM sqlite_sequence WHERE name = 'generations'`)
        .run()
      sqlite
        .prepare(
          `INSERT INTO sqlite_sequence (name, seq) VALUES ('generations', ?)`
        )
        .run(Math.max(sequence, maxId))
    })()
  } finally {
    sqlite.exec(`DETACH DATABASE backup`)
  }
}

const moveEntries = async (
  from: string,
  to: string,
  entries: readonly string[]
) => {
  const moved: string[] = []
  for (const entry of entries) {
    if (!(await exists(path.join(from, entry)))) continue
    await mkdir(to, { recursive: true })
    await rename(path.join(from, entry), path.join(to, entry))
    moved.push(entry)
  }
  return moved
}

// Replaces every table and data file with the backup's. The files move first, since a rename can
// be undone, and the tables are copied in one transaction on the open connection, so the app never
// has to reopen its database
export const applyBackup = async (
  database: ClientDatabase,
  token: string,
  { dataDirectory = defaultDataDirectory }: BackupOptions = {}
) => {
  const folder = getRestoreFolder(dataDirectory, token)
  const backupFile = path.join(folder, BACKUP_DATABASE_NAME)
  if (!(await exists(backupFile))) {
    throw new BackupError('Backup não encontrado. Envie o arquivo de novo.')
  }
  const filesFolder = path.join(folder, RESTORE_FILES_FOLDER)
  const oldFolder = path.join(folder, RESTORE_OLD_FOLDER)
  const sqlite = database.$client

  await renumberGenerations(sqlite, backupFile, filesFolder)

  const movedOut = await moveEntries(
    dataDirectory,
    oldFolder,
    BACKUP_DATA_ENTRIES
  )
  let movedIn: string[] = []
  try {
    movedIn = await moveEntries(filesFolder, dataDirectory, BACKUP_DATA_ENTRIES)
    copyDatabase(sqlite, backupFile)
  } catch (error) {
    await moveEntries(dataDirectory, filesFolder, movedIn)
    await moveEntries(oldFolder, dataDirectory, movedOut)
    throw error
  }
  await rm(folder, { recursive: true, force: true })
}

// A restart interrupts a download being built or a backup the store never confirmed
export const removeUnfinishedBackups = async (
  dataDirectory = defaultDataDirectory
) => {
  let entries: string[]
  try {
    entries = await readdir(dataDirectory)
  } catch {
    return
  }
  await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.startsWith(EXPORT_PREFIX) || entry.startsWith(RESTORE_PREFIX)
      )
      .map((entry) =>
        rm(path.join(dataDirectory, entry), { recursive: true, force: true })
      )
  )
}
