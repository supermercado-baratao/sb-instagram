'use server'

import { isOfferContent } from '@/domain/offer'
import { isValidCode, normalizeCode, type Product } from '@/domain/product'
import { database } from '@/infra/database/client'
import { saveOffer } from '@/infra/offer'
import { findProductByCode, saveProduct, searchProducts } from '@/infra/product'

export type SlotLookupResult =
  | { status: 'found'; product: Product }
  | { status: 'missing'; code: string }
  | { status: 'error'; message: string }

export type SaveOfferResult =
  { status: 'saved' } | { status: 'error'; message: string }

export const lookupSlotProduct = async (
  rawCode: string
): Promise<SlotLookupResult> => {
  const code = normalizeCode(rawCode)
  if (code === '') return { status: 'error', message: 'Informe o código.' }
  if (!isValidCode(code)) {
    return {
      status: 'error',
      message:
        'O código só pode ter letras sem acento, números, ponto, hífen e sublinhado.'
    }
  }

  const found = await findProductByCode(database, code)
  if (!found) return { status: 'missing', code }

  // An offer item points to a row of products, so a catalog product joins the store's products
  const product =
    found.source === 'catalog'
      ? await saveProduct(database, found)
      : found.product
  return { status: 'found', product }
}

// Only the instance: the catalog is looked up by code, through lookupSlotProduct
export const searchSlotProducts = async (query: string): Promise<Product[]> =>
  searchProducts(database, query)

export const saveOfferAction = async (
  id: number,
  content: unknown
): Promise<SaveOfferResult> => {
  if (!isOfferContent(content)) {
    return {
      status: 'error',
      message: 'Confira os dados da oferta: o nome não pode ficar vazio.'
    }
  }

  try {
    const saved = saveOffer(database, id, {
      ...content,
      name: content.name.trim()
    })
    return saved
      ? { status: 'saved' }
      : { status: 'error', message: 'Esta oferta não existe mais.' }
  } catch {
    // The editor only places saved products, so this is a code that isn't one (items' foreign key)
    return {
      status: 'error',
      message: 'Não foi possível salvar. Algum produto não está cadastrado.'
    }
  }
}
