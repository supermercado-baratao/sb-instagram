'use server'

import { refresh, revalidatePath } from 'next/cache'

import { OFFER_PATH, RADIO_AD_PATH } from '@/app/helpers/navigation'
import { database } from '@/infra/database/client'
import { copyGenerationPages, deleteGeneration } from '@/infra/generation'
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

export type CopyGenerationPagesResult =
  | { status: 'copied'; pageCount: number; missingProductCount: number }
  | { status: 'error'; message: string }

export const copyGenerationPagesAction = async (
  id: number,
  pageNumbers: number[]
): Promise<CopyGenerationPagesResult> => {
  if (
    !Number.isSafeInteger(id) ||
    !Array.isArray(pageNumbers) ||
    pageNumbers.some((pageNumber) => !Number.isSafeInteger(pageNumber))
  ) {
    return { status: 'error', message: 'Escolha as artes de novo.' }
  }
  try {
    const result = copyGenerationPages(database, id, pageNumbers)
    if (result.status === 'missing') {
      return {
        status: 'error',
        message:
          'Não foi possível copiar estas artes. Recarregue a página e tente de novo.'
      }
    }
    // The radio ad previews the saved offer, so both pages show the copy
    revalidatePath(OFFER_PATH)
    revalidatePath(RADIO_AD_PATH)
    return result
  } catch {
    return {
      status: 'error',
      message: 'Não foi possível copiar as artes. Tente de novo.'
    }
  }
}
