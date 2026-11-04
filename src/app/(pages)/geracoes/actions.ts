'use server'

import { refresh } from 'next/cache'

import { database } from '@/infra/database/client'
import { deleteGeneration } from '@/infra/generation'

export type DeleteGenerationResult =
  { status: 'deleted' } | { status: 'error'; message: string }

export const deleteGenerationAction = async (
  id: number
): Promise<DeleteGenerationResult> => {
  const missing = {
    status: 'error',
    message: 'Esta geração não existe mais.'
  } as const
  if (!Number.isSafeInteger(id)) return missing
  try {
    const deleted = await deleteGeneration(database, id)
    refresh()
    return deleted ? { status: 'deleted' } : missing
  } catch {
    return {
      status: 'error',
      message: 'Não foi possível excluir a geração. Tente de novo.'
    }
  }
}
