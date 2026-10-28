'use server'

import { revalidatePath } from 'next/cache'

import { isValidProductId, type Product } from '@/domain/product'
import { database } from '@/infra/database/client'
import {
  deleteProduct,
  type DeleteProductResult,
  DuplicateCodesError,
  type MergeInput,
  mergeProducts,
  MissingProductError,
  previewMerge
} from '@/infra/product'

type ActionError = { status: 'error'; message: string }

export const deleteProductAction = async (
  id: string
): Promise<DeleteProductResult | ActionError> => {
  if (!isValidProductId(id)) {
    return { status: 'error', message: 'Este produto não existe mais.' }
  }

  const result = await deleteProduct(database, id)
  revalidatePath('/produtos')
  return result
}

const isMergeInput = (input: MergeInput) =>
  isValidProductId(input.keepId) &&
  Array.isArray(input.mergedIds) &&
  input.mergedIds.length > 0 &&
  input.mergedIds.every((id) => isValidProductId(id)) &&
  new Set([input.keepId, ...input.mergedIds]).size ===
    input.mergedIds.length + 1

const getMergeError = (error: unknown): ActionError => {
  if (error instanceof DuplicateCodesError) {
    return {
      status: 'error',
      message: `Os produtos juntos teriam os mesmos códigos de “${error.product.name}”. Mescle-o junto ou escolha outros produtos.`
    }
  }
  if (error instanceof MissingProductError) {
    return {
      status: 'error',
      message:
        'Um dos produtos selecionados não existe mais. Atualize a página e selecione de novo.'
    }
  }
  throw error
}

export type MergePreviewResult =
  ActionError | { status: 'ok'; codes: string[]; offers: string[] }

export const previewMergeAction = async (
  input: MergeInput
): Promise<MergePreviewResult> => {
  if (!isMergeInput(input)) {
    return { status: 'error', message: 'Selecione dois ou mais produtos.' }
  }

  try {
    const { codes, offers } = previewMerge(database, input)
    return { status: 'ok', codes, offers }
  } catch (error) {
    return getMergeError(error)
  }
}

export const mergeProductsAction = async (
  input: MergeInput
): Promise<ActionError | { status: 'merged'; product: Product }> => {
  if (!isMergeInput(input)) {
    return { status: 'error', message: 'Selecione dois ou mais produtos.' }
  }

  try {
    const product = await mergeProducts(database, input)
    revalidatePath('/produtos')
    return { status: 'merged', product }
  } catch (error) {
    return getMergeError(error)
  }
}
