'use server'

import { revalidatePath } from 'next/cache'

import { isValidProductId } from '@/domain/product'
import { database } from '@/infra/database/client'
import { deleteProduct, type DeleteProductResult } from '@/infra/product'

export const deleteProductAction = async (
  id: string
): Promise<DeleteProductResult | { status: 'error'; message: string }> => {
  if (!isValidProductId(id)) {
    return { status: 'error', message: 'Este produto não existe mais.' }
  }

  const result = await deleteProduct(database, id)
  revalidatePath('/produtos')
  return result
}
