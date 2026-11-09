import { formatPrice, type OfferContent } from '@/domain/offer'

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// Generations keep the version they were recorded with, so an imported one may hold any of them.
// Only what the app reads back (the validity) is checked, the rest is the store's file
export const isStoredOfferExport = (
  value: unknown
): value is { version: number; validUntil: string | null } =>
  isRecord(value) &&
  [1, 2, 3].includes(value.version as number) &&
  (value.validUntil === null || typeof value.validUntil === 'string') &&
  Array.isArray(value.pages)
