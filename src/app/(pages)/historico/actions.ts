'use server'

import { refresh } from 'next/cache'

import { database } from '@/infra/database/client'
import { deleteGeneration } from '@/infra/generation'
import {
  discardGenerationImport,
  GenerationArchiveError,
  importGeneration
} from '@/infra/generation-archive'

export type DeleteGenerationResult =
  { status: 'deleted' } | { status: 'error'; message: string }

export const deleteGenerationAction = async (
  id: number
): Promise<DeleteGenerationResult> => {
  const missing = {
    status: 'error',
    message: 'Esta oferta não está mais no histórico.'
  } as const
  if (!Number.isSafeInteger(id)) return missing
  try {
    const deleted = await deleteGeneration(database, id)
    refresh()
    return deleted ? { status: 'deleted' } : missing
  } catch {
    return {
      status: 'error',
      message: 'Não foi possível excluir a oferta. Tente de novo.'
    }
  }
}

export type ImportGenerationResult =
  { status: 'imported'; number: number } | { status: 'error'; message: string }

export const importGenerationAction = async (
  token: string
): Promise<ImportGenerationResult> => {
  try {
    const generation = await importGeneration(database, token)
    refresh()
    return { status: 'imported', number: generation.number }
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof GenerationArchiveError
          ? error.message
          : 'Não foi possível importar a oferta. Tente de novo.'
    }
  }
}

export const discardGenerationImportAction = async (token: string) => {
  try {
    await discardGenerationImport(token)
  } catch {
    // Left for removeUnfinishedGenerations on the next start
  }
}
