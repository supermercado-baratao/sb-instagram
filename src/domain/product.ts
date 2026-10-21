import { CATALOG_IMAGE_EXTENSION, CATALOG_IMAGE_RULES } from '@/domain/catalog'
import { isValidEan } from '@/domain/ean'

export const CODE_TYPES = ['ean', 'internal'] as const

export type CodeType = (typeof CODE_TYPES)[number]

export type Product = {
  code: string
  codeType: CodeType
  name: string
  brand: string | null
  unit: string | null
  photo: string | null
}

export type ProductSource = 'instance' | 'catalog'

export type FoundProduct = {
  product: Product
  source: ProductSource
}

// USB scanners and copy-paste may bring surrounding or inner spaces, which a code never has
export const normalizeCode = (code: string) => code.replaceAll(/\s/g, '')

export const getCodeType = (code: string): CodeType =>
  isValidEan(code) ? 'ean' : 'internal'

// The code names the product photo file, so a separator or any other character outside this set
// could write or serve a file outside the photos folder
const CODE_PATTERN = /^[\w.-]+$/

export const isValidCode = (code: string) => CODE_PATTERN.test(code)

export const getPhotoFileName = (code: string) =>
  `${code}${CATALOG_IMAGE_EXTENSION}`

export const PHOTO_MAX_SIDE = CATALOG_IMAGE_RULES.maxSide

// Keep below serverActions.bodySizeLimit in next.config.ts, which also counts the form fields
export const PHOTO_MAX_MEGABYTES = 10

export const PRODUCTS_PAGE_SIZE = 50

export type ProductPage = {
  products: Product[]
  total: number
  page: number
  pageCount: number
}
