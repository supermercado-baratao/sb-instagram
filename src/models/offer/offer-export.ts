import { formatPrice, type OfferContent } from '@/models/offer/offer'

export type OfferExportProduct = {
  description: string
  unit: string | null
  codes: string[]
  price: string
}

export type OfferExport = {
  version: 3
  validUntil: string | null
  highlightTitle: string
  highlightMessage: string
  pages: { number: number; products: OfferExportProduct[] }[]
}

// Slots past the layout keep their products when the layout shrinks, but the poster doesn't show them
export const getOfferExport = (content: OfferContent): OfferExport => ({
  version: 3,
  validUntil: content.validUntil,
  highlightTitle: content.highlightTitle,
  highlightMessage: content.highlightMessage,
  pages: content.pages.map((page, index) => ({
    number: index + 1,
    products: page.slots
      .slice(0, page.layout)
      .filter((slot) => slot !== null)
      .map(({ product, priceInCents }) => ({
        description: product.description,
        unit: product.unit,
        codes: product.codes,
        price: formatPrice(priceInCents)
      }))
  }))
})
