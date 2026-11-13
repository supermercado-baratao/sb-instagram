import 'server-only'

import { randomUUID } from 'node:crypto'
import path from 'node:path'

import {
  createFolder,
  createZipWriter,
  fileExists,
  getExportFolder,
  getRestoreFolder,
  listDataFiles,
  moveEntries,
  readDataFile,
  readTextFile,
  removeFile,
  removeFolder,
  removeTemporaryBackupFolders
} from '@/infra/backup-files'
import { dataDirectory as defaultDataDirectory } from '@/infra/data-directory'
import {
  type ClientDatabase,
  copyDatabase,
  migrateBackupDatabase,
  renumberGenerations,
  snapshotDatabase
} from '@/infra/database/backup'
import { migrationsFolder as defaultMigrationsFolder } from '@/infra/database/file'
import type { Database } from '@/infra/database/relations'
import { AppError } from '@/infra/errors'
import { extractZip } from '@/infra/zip'
import { productModel } from '@/models/product/model'
import { backupRepo } from '@/repositories/backup-repo'

import {
  BACKUP_DATA_ENTRIES,
  BACKUP_DATABASE_NAME,
  BACKUP_MANIFEST_NAME,
  BACKUP_VERSION,
  type BackupChange,
  type BackupManifest,
  type BackupSummary,
  createBackupManifest,
  getBackupChanges,
  getBackupFileEntryName,
  getBackupFilePath
} from './backup'
import { backupManifestSchema, restoreTokenSchema } from './schema'

type BackupOptions = { dataDirectory?: string; migrationsFolder?: string }

const RESTORE_FILES_FOLDER = 'files'
const RESTORE_OLD_FOLDER = 'old'

const INVALID_BACKUP_MESSAGE =
  'O arquivo não é um backup do app. Escolha o arquivo .zip baixado em "Baixar backup".'

const NEWER_VERSION_MESSAGE =
  'Este backup foi feito numa versão mais nova do app. Atualize o app antes de restaurá-lo.'

const getTokenFolder = (dataDirectory: string, token: unknown) => {
  const parsed = restoreTokenSchema.safeParse(token)
  if (!parsed.success) throw new AppError('Backup não encontrado.')
  return getRestoreFolder(dataDirectory, parsed.data)
}

const summarize = (database: Database): BackupSummary =>
  backupRepo.summarize(database)

// The archive is read one file at a time as the response asks for it, so a store with years of
// generations never holds the whole backup in memory
async function* createArchive(
  database: ClientDatabase,
  { dataDirectory = defaultDataDirectory }: BackupOptions = {}
): AsyncGenerator<Uint8Array> {
  const folder = getExportFolder(dataDirectory, randomUUID())
  await createFolder(folder)
  try {
    const snapshot = path.join(folder, BACKUP_DATABASE_NAME)
    snapshotDatabase(database, snapshot)

    const zip = createZipWriter()
    const manifest = JSON.stringify(createBackupManifest(new Date()), null, 2)
    zip.add(BACKUP_MANIFEST_NAME, new TextEncoder().encode(manifest), 6)
    zip.add(BACKUP_DATABASE_NAME, await readDataFile(snapshot), 6)
    await removeFile(snapshot)
    yield* zip.flush()

    const files = await listDataFiles(dataDirectory, BACKUP_DATA_ENTRIES)
    for (const file of files) {
      let data
      try {
        data = await readDataFile(path.join(dataDirectory, file))
      } catch {
        // Deleted while the backup ran
        continue
      }
      // Photos and generations are PNG and PDF, already compressed
      zip.add(getBackupFileEntryName(file), data, 0)
      yield* zip.flush()
    }

    zip.end()
    yield* zip.flush()
  } finally {
    await removeFolder(folder)
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
): Promise<BackupManifest> => {
  let names: Set<string>
  try {
    names = await extractZip(archive, folder, getExtractTarget)
  } catch {
    throw new AppError(INVALID_BACKUP_MESSAGE)
  }
  if (!names.has(BACKUP_DATABASE_NAME)) {
    throw new AppError(INVALID_BACKUP_MESSAGE)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(
      await readTextFile(path.join(folder, BACKUP_MANIFEST_NAME))
    )
  } catch {
    throw new AppError(INVALID_BACKUP_MESSAGE)
  }
  const manifest = backupManifestSchema.safeParse(parsed)
  if (!manifest.success) throw new AppError(INVALID_BACKUP_MESSAGE)
  return manifest.data
}

export type PreparedBackup = {
  token: string
  manifest: BackupManifest
  summary: BackupSummary
}

// Nothing changes until apply: the file is only extracted and checked, so the store sees what it
// replaces first
const prepare = async (
  archive: AsyncIterable<Uint8Array>,
  {
    dataDirectory = defaultDataDirectory,
    migrationsFolder = defaultMigrationsFolder
  }: BackupOptions = {}
): Promise<PreparedBackup> => {
  const token = randomUUID()
  const folder = getTokenFolder(dataDirectory, token)
  await createFolder(folder)
  try {
    const manifest = await extractArchive(archive, folder)
    if (manifest.version > BACKUP_VERSION) {
      throw new AppError(NEWER_VERSION_MESSAGE)
    }
    const check = await migrateBackupDatabase(
      path.join(folder, BACKUP_DATABASE_NAME),
      migrationsFolder,
      summarize
    )
    if (check.status === 'newer') throw new AppError(NEWER_VERSION_MESSAGE)
    if (check.status === 'invalid') throw new AppError(INVALID_BACKUP_MESSAGE)
    return { token, manifest, summary: check.result }
  } catch (error) {
    await removeFolder(folder)
    throw error
  }
}

export type BackupPreview = {
  token: string
  createdAt: string
  changes: BackupChange[]
}

const preview = async (
  database: Database,
  archive: AsyncIterable<Uint8Array>,
  options: BackupOptions = {}
): Promise<BackupPreview> => {
  const { token, manifest, summary } = await prepare(archive, options)
  return {
    token,
    createdAt: manifest.createdAt,
    changes: getBackupChanges(summarize(database), summary)
  }
}

const discard = async (
  token: unknown,
  { dataDirectory = defaultDataDirectory }: BackupOptions = {}
) => removeFolder(getTokenFolder(dataDirectory, token))

// Replaces every table and data file with the backup's. The files move first, since a rename can
// be undone, and the tables are copied in one transaction on the open connection
const apply = async (
  database: ClientDatabase,
  token: unknown,
  { dataDirectory = defaultDataDirectory }: BackupOptions = {}
) => {
  const folder = getTokenFolder(dataDirectory, token)
  const backupFile = path.join(folder, BACKUP_DATABASE_NAME)
  if (!(await fileExists(backupFile))) {
    throw new AppError('Backup não encontrado. Envie o arquivo de novo.')
  }
  const filesFolder = path.join(folder, RESTORE_FILES_FOLDER)
  const oldFolder = path.join(folder, RESTORE_OLD_FOLDER)

  await renumberGenerations(
    database,
    backupFile,
    path.join(filesFolder, 'generations')
  )

  const movedOut = await moveEntries(
    dataDirectory,
    oldFolder,
    BACKUP_DATA_ENTRIES
  )
  let movedIn: string[] = []
  try {
    movedIn = await moveEntries(filesFolder, dataDirectory, BACKUP_DATA_ENTRIES)
    if (!copyDatabase(database, backupFile)) {
      throw new AppError(INVALID_BACKUP_MESSAGE)
    }
  } catch (error) {
    await moveEntries(dataDirectory, filesFolder, movedIn)
    await moveEntries(oldFolder, dataDirectory, movedOut)
    throw error
  }
  await removeFolder(folder)
  // A backup from before #55 keeps a group's photo under its old main code, like an instance that
  // starts after updating
  await productModel.renameOutdatedPhotos(database, {
    photos: path.join(dataDirectory, 'photos')
  })
}

const removeUnfinished = (dataDirectory = defaultDataDirectory) =>
  removeTemporaryBackupFolders(dataDirectory)

export const backupModel = {
  summarize,
  createArchive,
  prepare,
  preview,
  discard,
  apply,
  removeUnfinished
}
