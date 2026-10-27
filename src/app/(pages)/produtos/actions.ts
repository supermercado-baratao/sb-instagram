'use server'

import { revalidatePath } from 'next/cache'

import { INVALID_CODE_MESSAGE } from '@/app/helpers/product-code'
import { isValidCode, normalizeCode } from '@/domain/product'
import { database } from '@/infra/database/client'
import { deleteProduct, type DeleteProductResult } from '@/infra/product'

export const deleteProductAction = async (
  rawCode: string
): Promise<DeleteProductResult | { status: 'error'; message: string }> => {
  const code = normalizeCode(rawCode)
  if (!isValidCode(code)) {
    return { status: 'error', message: INVALID_CODE_MESSAGE }
  }

  const result = await deleteProduct(database, code)
  revalidatePath('/produtos')
  return result
}
