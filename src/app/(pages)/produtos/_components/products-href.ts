import type { ProductListFilter } from '@/models/product/product'

const FILTER_PARAMETERS = {
  store: 'loja',
  catalog: 'catalogo',
  'outside-catalog': 'enviar-ao-catalogo'
} as const

export const parseProductListFilter = (value: string): ProductListFilter => {
  const entry = Object.entries(FILTER_PARAMETERS).find(
    ([, parameter]) => parameter === value
  )
  return (entry?.[0] as ProductListFilter | undefined) ?? 'all'
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
