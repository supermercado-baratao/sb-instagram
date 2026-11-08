'use server'

import { revalidatePath } from 'next/cache'

import { applyBackup, BackupError, discardBackup } from '@/infra/backup'
import { database } from '@/infra/database/client'
import { renameOutdatedPhotos } from '@/infra/product'

export type ApplyBackupResult =
  { status: 'restored' } | { status: 'error'; message: string }

export const applyBackupAction = async (
  token: string
): Promise<ApplyBackupResult> => {
  try {
    await applyBackup(database, token)
    // A backup from before #55 keeps a group's photo under its old main code, like an instance that
    // starts after updating
    await renameOutdatedPhotos(database)
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof BackupError
          ? error.message
          : 'Não foi possível restaurar o backup. Os dados atuais não mudaram.'
    }
  }
  // Every page shows restored data, including the header's brand
  revalidatePath('/', 'layout')
  return { status: 'restored' }
}

export const discardBackupAction = async (token: string) => {
  try {
    await discardBackup(token)
  } catch {
    // Left for removeUnfinishedBackups on the next start
  }
}
