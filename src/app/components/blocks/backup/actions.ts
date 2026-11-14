'use server'

import { revalidatePath } from 'next/cache'

import { type ActionError, runAction } from '@/entry/action'
import { database } from '@/infra/database/client'
import { backupModel } from '@/models/backup/model'

export type ApplyBackupResult = ActionError | { status: 'restored' }

export const applyBackupAction = async (
  token: string
): Promise<ApplyBackupResult> =>
  runAction(
    {
      fallback:
        'Não foi possível restaurar o backup. Os dados atuais não mudaram.'
    },
    async () => {
      await backupModel.apply(database, token)
      // Every page shows restored data, including the header's brand
      revalidatePath('/', 'layout')
      return { status: 'restored' as const }
    }
  )

export const discardBackupAction = async (token: string) => {
  try {
    await backupModel.discard(token)
  } catch {
    // Left for removeUnfinished on the next start
  }
}
