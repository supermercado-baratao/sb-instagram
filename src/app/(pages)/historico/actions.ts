'use server'

import { refresh, revalidatePath } from 'next/cache'

import { OFFER_PATH, RADIO_AD_PATH } from '@/app/helpers/navigation'
import { type ActionError, runAction } from '@/entry/action'
import { database } from '@/infra/database/client'
import { generationModel } from '@/models/generation/model'
import { generationArchiveModel } from '@/models/generation-archive/model'

export type DeleteGenerationResult = ActionError | { status: 'deleted' }

export const deleteGenerationAction = async (
  id: number
): Promise<DeleteGenerationResult> =>
  runAction(
    { fallback: 'Não foi possível excluir a oferta. Tente de novo.' },
    async () => {
      await generationModel.remove(database, id)
      refresh()
      return { status: 'deleted' as const }
    }
  )

export type ImportGenerationResult =
  ActionError | { status: 'imported'; number: number }

export const importGenerationAction = async (
  token: string
): Promise<ImportGenerationResult> =>
  runAction(
    { fallback: 'Não foi possível importar a oferta. Tente de novo.' },
    async () => {
      const generation = await generationArchiveModel.importPrepared(
        database,
        token
      )
      refresh()
      return { status: 'imported' as const, number: generation.number }
    }
  )

export const discardGenerationImportAction = async (token: string) => {
  try {
    await generationArchiveModel.discardImport(token)
  } catch {
    // Left for removeUnfinished on the next start
  }
}

export type CopyGenerationPagesResult =
  | ActionError
  | { status: 'copied'; pageCount: number; missingProductCount: number }

export const copyGenerationPagesAction = async (
  id: number,
  pageNumbers: number[]
): Promise<CopyGenerationPagesResult> =>
  runAction(
    {
      fallback: 'Não foi possível copiar as artes. Tente de novo.',
      invalid: 'Escolha as artes de novo.'
    },
    () => {
      const result = generationModel.copyPages(database, { id, pageNumbers })
      // The radio ad previews the saved offer, so both pages show the copy
      revalidatePath(OFFER_PATH)
      revalidatePath(RADIO_AD_PATH)
      return result
    }
  )
