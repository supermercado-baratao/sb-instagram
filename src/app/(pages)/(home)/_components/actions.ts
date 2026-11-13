'use server'

import { revalidatePath } from 'next/cache'

import { OFFER_PATH, RADIO_AD_PATH } from '@/app/helpers/navigation'
import {
  isOfferContent,
  type OfferBackupSummary,
  type OfferContent
} from '@/domain/offer'
import { type ActionError, runAction } from '@/entry/action'
import { database } from '@/infra/database/client'
import { createGeneration } from '@/infra/generation'
import {
  findOffer,
  findOfferBackup,
  restoreOfferBackup,
  saveOffer
} from '@/infra/offer'
import { offerRenderer } from '@/infra/poster-renderer'
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
): Promise<SaveOfferResult> => {
  if (!isOfferContent(content)) {
    return {
      status: 'error',
      message: 'Confira os dados da oferta e tente de novo.'
    }
  }

  try {
    saveOffer(database, content)
    // A page keeps its old content for the browser's Back button, and saving that again would undo
    // this. The radio ad previews the saved offer, so it changes too
    revalidatePath(OFFER_PATH)
    revalidatePath(RADIO_AD_PATH)
    return { status: 'saved', backup: findOfferBackup(database) }
  } catch {
    // The editor only places saved products, so this is one deleted meanwhile (items' foreign key)
    return {
      status: 'error',
      message: 'Não foi possível salvar. Algum produto não está cadastrado.'
    }
  }
}

export const restoreOfferAction = async (): Promise<RestoreOfferResult> => {
  try {
    const restored = restoreOfferBackup(database)
    const content = restored && findOffer(database)
    if (!content) {
      return {
        status: 'error',
        message: 'Não há uma versão anterior da oferta para voltar.'
      }
    }
    revalidatePath(OFFER_PATH)
    revalidatePath(RADIO_AD_PATH)
    return {
      status: 'restored',
      content,
      backup: findOfferBackup(database),
      missingProductCount: restored.missingProductCount
    }
  } catch {
    return {
      status: 'error',
      message: 'Não foi possível voltar à versão anterior. Tente de novo.'
    }
  }
}

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
