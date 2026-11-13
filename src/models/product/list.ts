import { normalizeSearchText } from '@/infra/database/search-text'

import {
  type Product,
  type ProductDetails,
  type ProductListItem,
  type ProductPage,
  PRODUCTS_PAGE_SIZE
} from './product'

export const getSearchWords = (query: string) =>
  normalizeSearchText(query).split(/\s+/).filter(Boolean)

// Joining the fields lets a query mix them, e.g. a description and a unit ("sabonete 85"), like
// the SQLite search of the store's products
export const matchesProductQuery = (
  { description, unit, codes }: ProductDetails & Pick<Product, 'codes'>,
  query: string
) => {
  const fields = normalizeSearchText(
    [description, unit ?? '', codes.join(' ')].join(' ')
  )
  return getSearchWords(query).every((word) => fields.includes(word))
}

const getSortKey = ({ product }: ProductListItem) =>
  [normalizeSearchText(product.description), product.codes[0] ?? ''] as const

// Plain code unit order, like SQLite's BINARY collation, so both origins sort alike
const compareText = (a: string, b: string) => {
  if (a === b) return 0
  return a < b ? -1 : 1
}

export const compareProductListItems = (
  a: ProductListItem,
  b: ProductListItem
) => {
  const [descriptionA, codeA] = getSortKey(a)
  const [descriptionB, codeB] = getSortKey(b)
  return compareText(descriptionA, descriptionB) || compareText(codeA, codeB)
}

export const getProductPage = (
  items: ProductListItem[],
  page: number
): ProductPage => {
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE))
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount)
  const start = (current - 1) * PRODUCTS_PAGE_SIZE
  return {
    items: items.slice(start, start + PRODUCTS_PAGE_SIZE),
    total,
    page: current,
    pageCount
  }
}
