import { z } from 'zod'

import { BACKUP_FORMAT } from './backup'

export const backupManifestSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().positive(),
  createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)))
})

// The token names a temporary folder, so it must be one the server created
export const restoreTokenSchema = z.uuid()

// The browser's date, since the container's clock usually runs in UTC
export const backupDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
