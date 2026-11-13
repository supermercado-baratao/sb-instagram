'use server'

import { revalidatePath } from 'next/cache'

import { suggestVoiceText } from '@/domain/spoken-text'
import { type ActionError, runAction } from '@/entry/action'
import { database } from '@/infra/database/client'
import { listPronunciations } from '@/infra/pronunciation'
import {
  type LookupResult as ProductLookup,
  productModel,
  type SaveFormResult
} from '@/models/product/model'
import type { Product, ProductDetails } from '@/models/product/product'

export type LookupResult = ProductLookup | ActionError

export type SaveResult = SaveFormResult | ActionError

export const lookupProduct = async (rawCode: string): Promise<LookupResult> =>
  runAction(
    { fallback: 'Não foi possível buscar o produto. Tente de novo.' },
    () => productModel.lookup(database, rawCode)
  )

// Only the instance: the catalog is looked up by code, through lookupProduct
export const searchInstanceProducts = async (
  query: string
): Promise<Product[]> => productModel.search(database, query)

const readUnknownText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

// Takes what the form holds, saved or not, since the store suggests while it types
export const suggestProductVoiceText = async (
  details: Record<keyof ProductDetails, unknown>
): Promise<string> => {
  return suggestVoiceText(
    {
      description: readUnknownText(details.description),
      unit: readUnknownText(details.unit) || null
    },
    listPronunciations(database)
  )
}

export const saveProductForm = async (
  formData: FormData
): Promise<SaveResult> =>
  runAction(
    { fallback: 'Não foi possível salvar o produto. Tente de novo.' },
    async () => {
      const result = await productModel.saveForm(database, {
        codes: formData.getAll('code'),
        description: formData.get('description'),
        photo: formData.get('photo'),
        id: formData.get('id'),
        unit: formData.get('unit'),
        voiceText: formData.get('voiceText'),
        catalogImage: formData.get('catalogImage'),
        catalogEan: formData.get('catalogEan'),
        replace: formData.get('replace')
      })
      if (result.status === 'saved') revalidatePath('/produtos')
      return result
    }
  )

export const addCodeToProduct = async (
  id: string,
  code: string
): Promise<ActionError | { status: 'saved'; product: Product }> =>
  runAction(
    { fallback: 'Não foi possível adicionar o código. Tente de novo.' },
    async () => {
      const product = await productModel.addCode(database, { id, code })
      revalidatePath('/produtos')
      return { status: 'saved', product }
    }
  )

export { type PhotoChange } from '@/models/product/model'
