'use server'

import { revalidatePath } from 'next/cache'

import { INVALID_CODE_MESSAGE } from '@/app/helpers/product-code'
import {
  type CodeConflict,
  type CodeType,
  type ExtraCodeChanges,
  type FoundProduct,
  getCodeType,
  getExtraCodeChanges,
  getProductChanges,
  isValidCode,
  normalizeCode,
  normalizeExtraCodes,
  PHOTO_MAX_MEGABYTES,
  type Product,
  type ProductChange,
  type ProductSource
} from '@/domain/product'
import { database } from '@/infra/database/client'
import { copyNoEanImage, savePhoto } from '@/infra/photo'
import {
  CodeConflictError,
  findCodeConflicts,
  findProductByCode,
  saveProduct
} from '@/infra/product'

export type LookupResult =
  // The scanned code, which may be one of the product's extra codes
  | ({ status: 'found'; matchedCode: string } & FoundProduct)
  | { status: 'new'; code: string; codeType: CodeType }
  | { status: 'error'; message: string }

export type PhotoChange = 'added' | 'replaced' | null

export type SaveResult =
  | { status: 'saved'; product: Product }
  | { status: 'unchanged'; product: Product }
  | {
      status: 'confirm'
      current: Product
      changes: ProductChange[]
      codeChanges: ExtraCodeChanges
      photoChange: PhotoChange
    }
  | { status: 'error'; message: string }

export type ExtraCodeCheck =
  { status: 'valid'; code: string } | { status: 'error'; message: string }

const getConflictMessage = ({ code, product }: CodeConflict) =>
  `O código ${code} já pertence a ${product.name} (${product.code}).`

export const lookupProduct = async (rawCode: string): Promise<LookupResult> => {
  const code = normalizeCode(rawCode)
  if (code === '') return { status: 'error', message: 'Informe o código.' }
  if (!isValidCode(code)) {
    return { status: 'error', message: INVALID_CODE_MESSAGE }
  }

  const found = await findProductByCode(database, code)
  return found
    ? { status: 'found', matchedCode: code, ...found }
    : { status: 'new', code, codeType: getCodeType(code) }
}

// Saving checks the codes again, so this only spares the store from finding out at the end
export const checkExtraCode = async (
  productCode: string,
  rawCode: string
): Promise<ExtraCodeCheck> => {
  const code = normalizeCode(rawCode)
  if (code === '') return { status: 'error', message: 'Informe o código.' }
  if (!isValidCode(code)) {
    return { status: 'error', message: INVALID_CODE_MESSAGE }
  }
  if (code === normalizeCode(productCode)) {
    return { status: 'error', message: 'Este já é o código do produto.' }
  }

  const [conflict] = findCodeConflicts(database, normalizeCode(productCode), [
    code
  ])
  return conflict
    ? { status: 'error', message: getConflictMessage(conflict) }
    : { status: 'valid', code }
}

const readText = (formData: FormData, name: string) => {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

const readUpload = (formData: FormData) => {
  const file = formData.get('photo')
  return file instanceof File && file.size > 0 ? file : undefined
}

export const saveProductForm = async (
  formData: FormData
): Promise<SaveResult> => {
  const code = normalizeCode(readText(formData, 'code'))
  if (!isValidCode(code)) {
    return { status: 'error', message: INVALID_CODE_MESSAGE }
  }

  const name = readText(formData, 'name')
  if (name === '') {
    return { status: 'error', message: 'Informe o nome do produto.' }
  }

  const upload = readUpload(formData)
  if (upload && upload.size > PHOTO_MAX_MEGABYTES * 1024 * 1024) {
    return {
      status: 'error',
      message: `A foto precisa ter no máximo ${PHOTO_MAX_MEGABYTES} MB.`
    }
  }
  const codeType = getCodeType(code)
  const catalogImage =
    codeType === 'internal' ? readText(formData, 'catalogImage') : ''

  const details = {
    name,
    brand: readText(formData, 'brand') || null,
    unit: readText(formData, 'unit') || null
  }

  const extraCodes = normalizeExtraCodes(
    formData.getAll('extraCode').filter((value) => typeof value === 'string'),
    code
  )
  if (extraCodes.some((extra) => !isValidCode(extra))) {
    return { status: 'error', message: INVALID_CODE_MESSAGE }
  }
  // Checked before the photo is written, so a refused save leaves nothing behind
  const [conflict] = findCodeConflicts(database, code, [code, ...extraCodes])
  if (conflict) {
    return { status: 'error', message: getConflictMessage(conflict) }
  }

  // The current photo and source come from the server, never from the form
  const found = await findProductByCode(database, code)

  // Registering a code the store already has must not overwrite it unnoticed
  if (found?.source === 'instance' && readText(formData, 'replace') === 'ask') {
    const changes = getProductChanges(found.product, details)
    const codeChanges = getExtraCodeChanges(found.extraCodes, extraCodes)
    const hasNewPhoto = upload !== undefined || catalogImage !== ''
    if (
      !hasNewPhoto &&
      changes.length === 0 &&
      codeChanges.added.length === 0 &&
      codeChanges.removed.length === 0
    ) {
      return { status: 'unchanged', product: found.product }
    }
    const photoChange = found.product.photo ? 'replaced' : 'added'
    return {
      status: 'confirm',
      current: found.product,
      changes,
      codeChanges,
      photoChange: hasNewPhoto ? photoChange : null
    }
  }

  let photo = found?.product.photo ?? null
  let source: ProductSource = found?.source ?? 'instance'

  try {
    if (upload) {
      photo = await savePhoto(code, Buffer.from(await upload.arrayBuffer()))
      source = 'instance'
    } else if (catalogImage !== '') {
      photo = await copyNoEanImage(catalogImage, code)
      source = 'instance'
    }
  } catch {
    return {
      status: 'error',
      message: upload
        ? 'Não foi possível ler a foto. Envie uma imagem JPG, PNG ou WebP.'
        : 'A imagem escolhida não está mais no catálogo.'
    }
  }

  let product: Product
  try {
    product = await saveProduct(
      database,
      { product: { code, codeType, ...details, photo }, source },
      { extraCodes }
    )
  } catch (error) {
    // Another save took one of the codes after the check above
    if (!(error instanceof CodeConflictError)) throw error
    return { status: 'error', message: getConflictMessage(error.conflicts[0]) }
  }

  revalidatePath('/produtos')
  return { status: 'saved', product }
}
