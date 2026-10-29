import type { ProductListFilter } from '@/domain/product'

const FILTER_PARAMETERS = { store: 'loja', catalog: 'catalogo' } as const

export const parseProductListFilter = (value: string): ProductListFilter => {
  if (value === FILTER_PARAMETERS.store) return 'store'
  if (value === FILTER_PARAMETERS.catalog) return 'catalog'
  return 'all'
}

export type ProductsView = {
  query: string
  filter: ProductListFilter
  page?: number
}

export const getProductsHref = ({ query, filter, page = 1 }: ProductsView) => {
  const params = new URLSearchParams()
  if (query !== '') params.set('q', query)
  if (filter !== 'all') params.set('origem', FILTER_PARAMETERS[filter])
  if (page > 1) params.set('pagina', String(page))
  const search = params.toString()
  return search === '' ? '/produtos' : `/produtos?${search}`
}
