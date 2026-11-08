import { LOGO_FILE_NAME } from '@/domain/brand'

export const BACKUP_FORMAT = 'sb-instagram-backup'

export const BACKUP_VERSION = 1

export const BACKUP_MANIFEST_NAME = 'backup.json'

export const BACKUP_DATABASE_NAME = 'database.sqlite'

const BACKUP_FILES_PREFIX = 'files/'

// The entries of the data directory a backup carries, besides the database. A known list, so a
// restore never deletes something else a store keeps in the volume
export const BACKUP_DATA_ENTRIES = ['photos', 'generations', LOGO_FILE_NAME]

export type BackupManifest = {
  format: typeof BACKUP_FORMAT
  version: number
  createdAt: string
}

export type BackupSummary = {
  brandName: string | null
  productCount: number
  offerPageCount: number
  offerProductCount: number
  generationCount: number
  pronunciationCount: number
}

export type BackupChange = {
  label: string
  current: string
  backup: string
  changed: boolean
}

export type PrepareBackupResponse =
  | {
      status: 'ready'
      token: string
      createdAt: string
      changes: BackupChange[]
    }
  | { status: 'error'; message: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const isBackupManifest = (value: unknown): value is BackupManifest =>
  isRecord(value) &&
  value.format === BACKUP_FORMAT &&
  typeof value.version === 'number' &&
  Number.isSafeInteger(value.version) &&
  value.version >= 1 &&
  typeof value.createdAt === 'string' &&
  !Number.isNaN(Date.parse(value.createdAt))

export const createBackupManifest = (createdAt: Date): BackupManifest => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  createdAt: createdAt.toISOString()
})

export const getBackupFileEntryName = (relativePath: string) =>
  `${BACKUP_FILES_PREFIX}${relativePath}`

// Names come from an uploaded file, so each one must be a plain relative path under one of the
// known data entries before it reaches the disk
export const getBackupFilePath = (entryName: string) => {
  if (!entryName.startsWith(BACKUP_FILES_PREFIX)) return
  const segments = entryName.slice(BACKUP_FILES_PREFIX.length).split('/')
  if (!BACKUP_DATA_ENTRIES.includes(segments[0])) return
  if ((segments[0] === LOGO_FILE_NAME) !== (segments.length === 1)) return
  const valid = segments.every(
    (segment) =>
      segment !== '' &&
      !segment.startsWith('.') &&
      !segment.includes('\\') &&
      !segment.includes('\0')
  )
  return valid ? segments : undefined
}

export const isBackupDateParameter = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

export const getBackupDownloadName = (date: string) =>
  `sb-instagram-backup-${date}.zip`

const formatCount = (count: number) => count.toLocaleString('pt-BR')

export const getBackupChanges = (
  current: BackupSummary,
  backup: BackupSummary
): BackupChange[] => {
  const rows: [string, string, string][] = [
    ['Marca', current.brandName ?? '—', backup.brandName ?? '—'],
    ...(
      [
        ['Produtos', 'productCount'],
        ['Páginas da oferta', 'offerPageCount'],
        ['Produtos na oferta', 'offerProductCount'],
        ['Gerações', 'generationCount'],
        ['Termos do dicionário', 'pronunciationCount']
      ] as const
    ).map(([label, key]): [string, string, string] => [
      label,
      formatCount(current[key]),
      formatCount(backup[key])
    ])
  ]
  return rows.map(([label, currentValue, backupValue]) => ({
    label,
    current: currentValue,
    backup: backupValue,
    changed: currentValue !== backupValue
  }))
}
