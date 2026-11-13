'use server'

import { revalidatePath } from 'next/cache'

import { type ActionError, runAction } from '@/entry/action'
import { database } from '@/infra/database/client'
import { type DeleteProductResult, productModel } from '@/models/product/model'
import type { Product } from '@/models/product/product'
import type { MergeInput } from '@/models/product/schema'

export const deleteProductAction = async (
  id: string
): Promise<DeleteProductResult | ActionError> =>
  runAction(
    {
      fallback: 'Não foi possível excluir o produto. Tente de novo.',
      invalid: 'Este produto não existe mais.'
    },
    async () => {
      const result = await productModel.remove(database, id)
      revalidatePath('/produtos')
      return result
    }
  )

const MERGE_OPTIONS = {
  fallback: 'Não foi possível mesclar os produtos. Tente de novo.',
  invalid: 'Selecione dois ou mais produtos.'
}

export type MergePreviewResult =
  ActionError | { status: 'ok'; codes: string[]; changesOffer: boolean }

export const previewMergeAction = async (
  input: MergeInput
): Promise<MergePreviewResult> =>
  runAction(MERGE_OPTIONS, () => {
    const { codes, changesOffer } = productModel.previewMerge(database, input)
    return { status: 'ok' as const, codes, changesOffer }
  })

export const mergeProductsAction = async (
  input: MergeInput
): Promise<ActionError | { status: 'merged'; product: Product }> =>
  runAction(MERGE_OPTIONS, async () => {
    const product = await productModel.merge(database, input)
    revalidatePath('/produtos')
    return { status: 'merged' as const, product }
  })
