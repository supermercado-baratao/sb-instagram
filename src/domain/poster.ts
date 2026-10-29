export type Brand = {
  name: string
  logo: string | null
  slogan: string
  instagram: string
}

// Templates are instance data: each store creates as many as it wants (e.g. "Mercado",
// "Açougue", "Hortifrúti"), so there is no fixed list of template ids in code.
export type PosterTemplate = {
  id: string
  name: string
  colors: {
    primary: string
    accent: string
  }
}

export type CodeType = 'ean' | 'internal'

export type Product = {
  code: string
  codeType: CodeType
  name: string
  brand: string
  unit: string
  image: string | null
}

export type OfferProduct = Product & {
  // Integer cents avoid floating-point rounding when prices are formatted or summed
  priceInCents: number
}

export type Offer = {
  validUntil: string
  highlightTitle: string
  highlightMessage: string
}

export type PosterLayout = 9 | 6 | 4 | 3

export type PosterLayoutConfig = {
  id: PosterLayout
  columns: number
  rows: number
  scale: number
  orientation: 'vertical' | 'horizontal'
}

// A page always keeps PAGE_PRODUCT_COUNT products and the layout only decides how many are shown,
// so switching to a smaller layout and back never loses what was filled in
export const PAGE_PRODUCT_COUNT = 9

export type Page = {
  templateId: string
  layout: PosterLayout
  products: OfferProduct[]
}

export const posterLayouts: PosterLayoutConfig[] = [
  { id: 9, columns: 3, rows: 3, scale: 1, orientation: 'vertical' },
  { id: 6, columns: 3, rows: 2, scale: 1.15, orientation: 'vertical' },
  { id: 4, columns: 2, rows: 2, scale: 1.4, orientation: 'vertical' },
  { id: 3, columns: 1, rows: 3, scale: 1.3, orientation: 'horizontal' }
]

export const DEFAULT_POSTER_LAYOUT: PosterLayout = 9

export const isPosterLayout = (value: unknown): value is PosterLayout =>
  posterLayouts.some((layout) => layout.id === value)

export const getPosterLayout = (layout: PosterLayout) =>
  posterLayouts.find((config) => config.id === layout) ?? posterLayouts[0]

export const getVisibleProducts = (page: Pick<Page, 'layout' | 'products'>) =>
  page.products.slice(0, page.layout)

// A template can be deleted while pages still point to it, so they fall back to the first one
export const getPageTemplate = (
  templates: PosterTemplate[],
  templateId: string
): PosterTemplate | undefined =>
  templates.find((template) => template.id === templateId) ?? templates[0]

// An empty field shows the placeholder, so hiding a line needs an explicit marker
export const HIDDEN_FIELD_MARKER = '-'

export const isHiddenField = (value: string) =>
  value.trim() === HIDDEN_FIELD_MARKER

// Instagram's portrait ratio (4:5), the tallest a feed post is shown without cropping
export const POSTER_SIZE = { width: 1080, height: 1350 }

// Never above 1, since an enlarged poster would show blurrier photos than the PNG
export const getPosterFitScale = ({
  width,
  height
}: {
  width: number
  height: number
}) => Math.min(1, width / POSTER_SIZE.width, height / POSTER_SIZE.height)

// Returns null when the field is hidden, so the poster drops the whole line
export const resolvePosterField = (value: string, placeholder: string) =>
  isHiddenField(value) ? null : value.trim() || placeholder

export const splitPrice = (priceInCents: number) => ({
  integer: String(Math.trunc(priceInCents / 100)),
  decimal: String(priceInCents % 100).padStart(2, '0')
})
