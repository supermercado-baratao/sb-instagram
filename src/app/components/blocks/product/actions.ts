'use server'

import { revalidatePath } from 'next/cache'

import { INVALID_CODE_MESSAGE } from '@/app/helpers/product-code'
import { isValidEan } from '@/domain/ean'
import {
  type CatalogMatch,
  type CodeType,
  getCodeType,
  getProductChanges,
  isValidCode,
  isValidProductId,
  normalizeCode,
  normalizeCodes,
  PHOTO_MAX_MEGABYTES,
  type Product,
  type ProductChange
} from '@/domain/product'
import { database } from '@/infra/database/client'
import {
  DuplicateCodesError,
  findProductById,
  findProductsByCode,
  findProductWithCodes,
  MissingProductError,
  type PhotoSource,
  PhotoSourceError,
  saveProduct,
  searchProducts
} from '@/infra/product'

export type LookupResult =
  // Every product of the instance with the code, a single product before the groups
  | { status: 'found'; code: string; products: Product[] }
  | { status: 'catalog'; code: string; product: CatalogMatch }
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
      photoChange: PhotoChange
    }
  | { status: 'error'; message: string }

const getDuplicateMessage = ({ name }: Product) =>
  `Já existe um produto com estes mesmos códigos: ${name}.`

export const lookupProduct = async (rawCode: string): Promise<LookupResult> => {
  const code = normalizeCode(rawCode)
  if (code === '') return { status: 'error', message: 'Informe o código.' }
  if (!isValidCode(code)) {
    return { status: 'error', message: INVALID_CODE_MESSAGE }
  }

  const found = await findProductsByCode(database, code)
  if (!found) return { status: 'new', code, codeType: getCodeType(code) }
  return found.source === 'instance'
    ? { status: 'found', code, products: found.products }
    : { status: 'catalog', code, product: found.product }
}

// Only the instance: the catalog is looked up by code, through lookupProduct
export const searchInstanceProducts = async (
  query: string
): Promise<Product[]> => searchProducts(database, query)

const readText = (formData: FormData, name: string) => {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

const readUpload = (formData: FormData) => {
  const file = formData.get('photo')
  return file instanceof File && file.size > 0 ? file : undefined
}

const PHOTO_ERROR_MESSAGES: Record<PhotoSource['kind'], string> = {
  upload: 'Não foi possível ler a foto. Envie uma imagem JPG, PNG ou WebP.',
  'no-ean': 'A imagem escolhida não está mais no catálogo.',
  ean: 'Não foi possível copiar a imagem do catálogo.'
}

export const saveProductForm = async (
  formData: FormData
): Promise<SaveResult> => {
  const codes = normalizeCodes(
    formData.getAll('code').filter((value) => typeof value === 'string')
  )
  if (codes.length === 0) {
    return { status: 'error', message: 'Informe pelo menos um código.' }
  }
  if (codes.some((code) => !isValidCode(code))) {
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
  // The community's no-EAN images are for products the catalog can't know by code
  const catalogImage = codes.some((code) => getCodeType(code) === 'ean')
    ? ''
    : readText(formData, 'catalogImage')
  const catalogEan = readText(formData, 'catalogEan')

  const details = {
    name,
    brand: readText(formData, 'brand') || null,
    unit: readText(formData, 'unit') || null
  }

  const formId = readText(formData, 'id')
  if (formId !== '' && !isValidProductId(formId)) {
    return { status: 'error', message: 'Este produto não existe mais.' }
  }

  // The current product and photo come from the server, never from the form
  let current = formId === '' ? undefined : findProductById(database, formId)
  if (formId !== '' && !current) {
    return { status: 'error', message: 'Este produto não existe mais.' }
  }

  const duplicate = findProductWithCodes(database, codes)
  if (duplicate && current && duplicate.id !== current.id) {
    return { status: 'error', message: getDuplicateMessage(duplicate) }
  }
  if (duplicate && !current) {
    const replace = readText(formData, 'replace')
    if (replace !== 'ask' && replace !== 'confirmed') {
      return { status: 'error', message: getDuplicateMessage(duplicate) }
    }

    // Registering the codes of a product the store already has must not overwrite it unnoticed
    if (replace === 'ask') {
      const changes = getProductChanges(duplicate, details)
      const hasNewPhoto = upload !== undefined || catalogImage !== ''
      if (!hasNewPhoto && changes.length === 0) {
        return { status: 'unchanged', product: duplicate }
      }
      const photoChange = duplicate.photo ? 'replaced' : 'added'
      return {
        status: 'confirm',
        current: duplicate,
        changes,
        photoChange: hasNewPhoto ? photoChange : null
      }
    }
    current = duplicate
  }

  let photo: PhotoSource | undefined
  if (upload) {
    photo = { kind: 'upload', image: Buffer.from(await upload.arrayBuffer()) }
  } else if (catalogImage !== '') {
    photo = { kind: 'no-ean', name: catalogImage }
  } else if (!current && isValidEan(catalogEan)) {
    // A new product found in the community catalog starts with the image the form showed
    photo = { kind: 'ean', ean: catalogEan }
  }

  let product: Product
  try {
    product = await saveProduct(database, {
      id: current?.id,
      codes,
      ...details,
      photo
    })
  } catch (error) {
    // Another save took these codes or removed the product after the checks above
    if (error instanceof DuplicateCodesError) {
      return { status: 'error', message: getDuplicateMessage(error.product) }
    }
    if (error instanceof MissingProductError) {
      return { status: 'error', message: 'Este produto não existe mais.' }
    }
    if (photo && error instanceof PhotoSourceError) {
      return { status: 'error', message: PHOTO_ERROR_MESSAGES[photo.kind] }
    }
    throw error
  }

  revalidatePath('/produtos')
  return { status: 'saved', product }
}

export const addCodeToProduct = async (
  id: string,
  rawCode: string
): Promise<
  { status: 'saved'; product: Product } | { status: 'error'; message: string }
> => {
  const code = normalizeCode(rawCode)
  if (!isValidCode(code)) {
    return { status: 'error', message: INVALID_CODE_MESSAGE }
  }
  const current = isValidProductId(id)
    ? findProductById(database, id)
    : undefined
  if (!current) {
    return { status: 'error', message: 'Este produto não existe mais.' }
  }

  let product: Product
  try {
    product = await saveProduct(database, {
      id: current.id,
      codes: [...current.codes, code],
      name: current.name,
      brand: current.brand,
      unit: current.unit
    })
  } catch (error) {
    if (error instanceof DuplicateCodesError) {
      return { status: 'error', message: getDuplicateMessage(error.product) }
    }
    if (error instanceof MissingProductError) {
      return { status: 'error', message: 'Este produto não existe mais.' }
    }
    throw error
  }

  revalidatePath('/produtos')
  return { status: 'saved', product }
}
