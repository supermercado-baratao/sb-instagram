'use server'

import { revalidatePath } from 'next/cache'

import { OFFER_PATH, RADIO_AD_PATH } from '@/app/helpers/navigation'
import { type ActionError, runAction } from '@/entry/action'
import { database } from '@/infra/database/client'
import { createGeneration } from '@/infra/generation'
import { offerRenderer } from '@/infra/poster-renderer'
import { offerModel } from '@/models/offer/model'
import type { OfferBackupSummary, OfferContent } from '@/models/offer/offer'
import {
  productModel,
  type SlotLookupResult as ProductSlotLookup
} from '@/models/product/model'

export type SlotLookupResult = ProductSlotLookup | ActionError

export type SaveOfferResult =
  | { status: 'saved'; backup: OfferBackupSummary | undefined }
  | { status: 'error'; message: string }

export type RestoreOfferResult =
  | {
      status: 'restored'
      content: OfferContent
      backup: OfferBackupSummary | undefined
      missingProductCount: number
    }
  | { status: 'error'; message: string }

export type GenerateOfferResult =
  { status: 'generated'; number: number } | { status: 'error'; message: string }

export const lookupSlotProduct = async (
  rawCode: string
): Promise<SlotLookupResult> =>
  runAction(
    { fallback: 'Não foi possível buscar o produto. Tente de novo.' },
    () => productModel.lookupForSlot(database, rawCode)
  )

export const saveOfferAction = async (
  content: unknown
): Promise<SaveOfferResult> =>
  runAction(
    {
      // The editor only places saved products, so this is one deleted meanwhile (items' foreign key)
      fallback: 'Não foi possível salvar. Algum produto não está cadastrado.',
      invalid: 'Confira os dados da oferta e tente de novo.'
    },
    () => {
      offerModel.save(database, content)
      // A page keeps its old content for the browser's Back button, and saving that again would
      // undo this. The radio ad previews the saved offer, so it changes too
      revalidatePath(OFFER_PATH)
      revalidatePath(RADIO_AD_PATH)
      return {
        status: 'saved' as const,
        backup: offerModel.findBackup(database)
      }
    }
  )

export const restoreOfferAction = async (): Promise<RestoreOfferResult> =>
  runAction(
    { fallback: 'Não foi possível voltar à versão anterior. Tente de novo.' },
    () => {
      const { content, missingProductCount } =
        offerModel.restoreBackup(database)
      revalidatePath(OFFER_PATH)
      revalidatePath(RADIO_AD_PATH)
      return {
        status: 'restored' as const,
        content,
        backup: offerModel.findBackup(database),
        missingProductCount
      }
    }
  )

export const generateOfferAction = async (): Promise<GenerateOfferResult> => {
  try {
    const generation = await createGeneration(database, offerRenderer)
    if (!generation) {
      return { status: 'error', message: 'Salve a oferta antes de gerar.' }
    }
    return { status: 'generated', number: generation.number }
  } catch {
    return {
      status: 'error',
      message: 'Não foi possível gerar a oferta. Tente de novo.'
    }
  }
}
