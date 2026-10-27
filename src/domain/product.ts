import { CATALOG_IMAGE_EXTENSION, CATALOG_IMAGE_RULES } from '@/domain/catalog'
import { isValidEan } from '@/domain/ean'

export const CODE_TYPES = ['ean', 'internal'] as const

export type CodeType = (typeof CODE_TYPES)[number]

// A product has no main code: a single photo may group variations sold under different codes
// (#49), and one code may be in several products, e.g. a single fragrance and the group (#55)
export type Product = {
  id: string
  codes: string[]
  name: string
  brand: string | null
  unit: string | null
  photo: string | null
}

export type ProductDetails = Pick<Product, 'name' | 'brand' | 'unit'>

export type ProductChange = {
  field: keyof ProductDetails
  from: string | null
  to: string | null
}

const DETAIL_FIELDS = ['name', 'brand', 'unit'] as const

export const getProductChanges = (
  current: ProductDetails,
  next: ProductDetails
): ProductChange[] =>
  DETAIL_FIELDS.filter((field) => current[field] !== next[field]).map(
    (field) => ({ field, from: current[field], to: next[field] })
  )

// A community catalog product the store hasn't saved yet, found by its EAN
export type CatalogMatch = ProductDetails & { code: string }

// USB scanners and copy-paste may bring surrounding or inner spaces, which a code never has
export const normalizeCode = (code: string) => code.replaceAll(/\s/g, '')

export const getCodeType = (code: string): CodeType =>
  isValidEan(code) ? 'ean' : 'internal'

// The code names the product photo file, so a separator or any other character outside this set
// could write or serve a file outside the photos folder
const CODE_PATTERN = /^[\w.-]+$/

export const isValidCode = (code: string) => CODE_PATTERN.test(code)

// Sorted, so two products with the same codes in any order compare equal
export const normalizeCodes = (codes: string[]) =>
  [
    ...new Set(codes.map((code) => normalizeCode(code)).filter(Boolean))
  ].toSorted((a, b) => a.localeCompare(b))

export const isSameCodeSet = (a: string[], b: string[]) => {
  const left = normalizeCodes(a)
  const right = normalizeCodes(b)
  return (
    left.length === right.length &&
    left.every((code, index) => code === right[index])
  )
}

const PRODUCT_ID_PATTERN =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/

export const isValidProductId = (id: string) => PRODUCT_ID_PATTERN.test(id)

// A product with one code keeps its photo under that code, so the photos folder stays readable.
// A group has no code of its own and uses its id, which never matches a code a store uses
export const getPhotoFileName = ({
  id,
  codes
}: Pick<Product, 'id' | 'codes'>) =>
  `${codes.length === 1 ? codes[0] : id}${CATALOG_IMAGE_EXTENSION}`

export const PHOTO_MAX_SIDE = CATALOG_IMAGE_RULES.maxSide

// Keep below serverActions.bodySizeLimit in next.config.ts, which also counts the form fields
export const PHOTO_MAX_MEGABYTES = 10

export const PRODUCTS_PAGE_SIZE = 50

export const PRODUCT_SUGGESTION_LIMIT = 8

export const normalizeSearchText = (text: string) =>
  text.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase()

export type ProductPage = {
  products: Product[]
  total: number
  page: number
  pageCount: number
}
