'use server'

import { INVALID_CODE_MESSAGE } from '@/app/helpers/product-code'
import { isOfferContent } from '@/domain/offer'
import { isValidCode, normalizeCode, type Product } from '@/domain/product'
import { getRadioScriptWarning } from '@/domain/radio-script'
import { database } from '@/infra/database/client'
import { createGeneration } from '@/infra/generation'
import { saveOffer } from '@/infra/offer'
import { offerRenderer } from '@/infra/poster-renderer'
import { findProductsByCode, saveProduct } from '@/infra/product'

export type SlotLookupResult =
  | { status: 'found'; product: Product }
  // The code is in a single product and in groups that also have it (#55)
  | { status: 'choose'; code: string; products: Product[] }
  | { status: 'missing'; code: string }
  | { status: 'error'; message: string }

export type SaveOfferResult =
  { status: 'saved' } | { status: 'error'; message: string }

export type GenerateOfferResult =
  | { status: 'generated'; number: number; warning?: string }
  | { status: 'error'; message: string }

export const lookupSlotProduct = async (
  rawCode: string
): Promise<SlotLookupResult> => {
  const code = normalizeCode(rawCode)
  if (code === '') return { status: 'error', message: 'Informe o código.' }
  if (!isValidCode(code)) {
    return { status: 'error', message: INVALID_CODE_MESSAGE }
  }

  const found = await findProductsByCode(database, code)
  if (!found) return { status: 'missing', code }

  if (found.source === 'instance') {
    return found.products.length === 1
      ? { status: 'found', product: found.products[0] }
      : { status: 'choose', code, products: found.products }
  }

  // An offer item points to a row of products, so a catalog product joins the store's products
  const { ean, ...details } = found.product
  const product = await saveProduct(database, {
    ...details,
    photo: { kind: 'ean', ean }
  })
  return { status: 'found', product }
}

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
    return { status: 'saved' }
  } catch {
    // The editor only places saved products, so this is one deleted meanwhile (items' foreign key)
    return {
      status: 'error',
      message: 'Não foi possível salvar. Algum produto não está cadastrado.'
    }
  }
}

export const generateOfferAction = async (): Promise<GenerateOfferResult> => {
  try {
    const generation = await createGeneration(database, offerRenderer)
    if (!generation) {
      return { status: 'error', message: 'Salve a oferta antes de gerar.' }
    }
    return {
      status: 'generated',
      number: generation.number,
      warning: generation.radioScript
        ? getRadioScriptWarning(generation.radioScript)
        : undefined
    }
  } catch {
    return {
      status: 'error',
      message: 'Não foi possível gerar a oferta. Tente de novo.'
    }
  }
}
