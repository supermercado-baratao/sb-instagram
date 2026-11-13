import { readdir, rename } from 'node:fs/promises'
import path from 'node:path'

import BetterSqlite3 from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import { fileExists } from '@/infra/backup-files'

import { type Database, relations } from './relations'

// The instance's own connection, since a backup reads and replaces the whole file
export type ClientDatabase = Database & { $client: BetterSqlite3.Database }

const MIGRATIONS_TABLE = '__drizzle_migrations'

// A consistent copy while the app keeps running (https://sqlite.org/lang_vacuum.html#vacuuminto)
export const snapshotDatabase = (database: ClientDatabase, file: string) => {
  database.$client.prepare('VACUUM INTO ?').run(file)
}

// Undefined for a file without the migrations table, which no instance ever wrote
const listAppliedMigrations = (sqlite: BetterSqlite3.Database) => {
  const table = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(MIGRATIONS_TABLE)
  if (!table) return
  return (
    sqlite.prepare(`SELECT name FROM "${MIGRATIONS_TABLE}"`).all() as {
      name: string | null
    }[]
  ).map(({ name }) => name)
}

export type BackupDatabaseCheck<T> =
  { status: 'invalid' } | { status: 'newer' } | { status: 'ready'; result: T }

// Runs the migrations an instance runs on startup, so the copy's tables match the instance's, and
// then reads it. A migration the app doesn't know means a newer version wrote the file
export const migrateBackupDatabase = async <T>(
  file: string,
  migrationsFolder: string,
  read: (database: Database) => T
): Promise<BackupDatabaseCheck<T>> => {
  let sqlite: BetterSqlite3.Database | undefined
  try {
    sqlite = new BetterSqlite3(file, { fileMustExist: true })
    sqlite.pragma('foreign_keys = ON')
    const applied = listAppliedMigrations(sqlite)
    if (!applied) return { status: 'invalid' }
    const known = new Set(await readdir(migrationsFolder))
    if (applied.some((name) => !name || !known.has(name))) {
      return { status: 'newer' }
    }
    const database = drizzle({ client: sqlite, relations })
    migrate(database, { migrationsFolder })
    return { status: 'ready', result: read(database) }
  } catch {
    return { status: 'invalid' }
  } finally {
    sqlite?.close()
  }
}

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
export const renumberGenerations = async (
  database: ClientDatabase,
  backupFile: string,
  generationsFolder: string
) => {
  const backup = new BetterSqlite3(backupFile, { fileMustExist: true })
  try {
    const ids = (
      backup.prepare(`SELECT id FROM generations ORDER BY id`).all() as {
        id: number
      }[]
    ).map(({ id }) => id)
    if (ids.length === 0) return
    const offset = Math.max(
      getSequence(database.$client, 'generations'),
      ...ids
    )
    backup.prepare(`UPDATE generations SET id = id + ?`).run(offset)
    for (const id of ids) {
      const source = path.join(generationsFolder, String(id))
      if (await fileExists(source)) {
        await rename(source, path.join(generationsFolder, String(id + offset)))
      }
    }
  } finally {
    backup.close()
  }
}

// Replaces every table with the backup's in one transaction on the open connection, so the app
// never has to reopen its database. False, changing nothing, when the tables differ
export const copyDatabase = (database: ClientDatabase, backupFile: string) => {
  const sqlite = database.$client
  const sequence = getSequence(sqlite, 'generations')
  sqlite.prepare(`ATTACH DATABASE ? AS backup`).run(backupFile)
  try {
    const tables = listTables(sqlite, 'main')
    const backupTables = new Set(listTables(sqlite, 'backup'))
    if (
      tables.length !== backupTables.size ||
      tables.some((table) => !backupTables.has(table))
    ) {
      return false
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
    return true
  } finally {
    sqlite.exec(`DETACH DATABASE backup`)
  }
}
