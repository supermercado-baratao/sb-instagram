import { formatPrice, type OfferContent } from '@/domain/offer'

export type OfferExportProduct = {
  name: string
  brand: string | null
  unit: string | null
  codes: string[]
  price: string
}

export type OfferExport = {
  version: 1
  name: string
  validUntil: string | null
  highlightTitle: string
  highlightMessage: string
  pages: { number: number; products: OfferExportProduct[] }[]
}

// Slots past the layout keep their products when the layout shrinks, but the poster doesn't show them
export const getOfferExport = (content: OfferContent): OfferExport => ({
  version: 1,
  name: content.name,
  validUntil: content.validUntil,
  highlightTitle: content.highlightTitle,
  highlightMessage: content.highlightMessage,
  pages: content.pages.map((page, index) => ({
    number: index + 1,
    products: page.slots
      .slice(0, page.layout)
      .filter((slot) => slot !== null)
      .map(({ product, priceInCents }) => ({
        name: product.name,
        brand: product.brand,
        unit: product.unit,
        codes: product.codes,
        price: formatPrice(priceInCents)
      }))
  }))
})
