import {
  DEFAULT_POSTER_LAYOUT,
  PAGE_PRODUCT_COUNT,
  type PosterLayout
} from '@/domain/poster'
import type { Product } from '@/domain/product'

export type OfferItem = {
  product: Product
  priceInCents: number
}

// Slots are positional, so an empty one is kept as null instead of being dropped
export type OfferSlot = OfferItem | null

export type OfferPage = {
  templateId: string
  layout: PosterLayout
  slots: OfferSlot[]
}

export type OfferContent = {
  name: string
  // ISO date (YYYY-MM-DD), the value of a date input
  validUntil: string | null
  highlightTitle: string
  highlightMessage: string
  pages: OfferPage[]
}

export type SavedOffer = OfferContent & { id: number }

export type OfferSummary = {
  id: number
  name: string
  validUntil: string | null
  pageCount: number
  updatedAt: Date
}

export const createOfferPage = (templateId: string): OfferPage => ({
  templateId,
  layout: DEFAULT_POSTER_LAYOUT,
  slots: Array.from({ length: PAGE_PRODUCT_COUNT }, () => null)
})

export const createOfferContent = (templateId: string): OfferContent => ({
  name: 'Nova oferta',
  validUntil: null,
  highlightTitle: 'Ofertas da semana',
  highlightMessage: 'Só nesta loja',
  pages: [createOfferPage(templateId)]
})

export const getCopyName = (name: string) => `${name} (cópia)`

export const placeSlots = (
  items: (OfferItem & { position: number })[]
): OfferSlot[] => {
  const slots: OfferSlot[] = Array.from(
    { length: PAGE_PRODUCT_COUNT },
    () => null
  )
  for (const { position, product, priceInCents } of items) {
    if (position >= 0 && position < PAGE_PRODUCT_COUNT) {
      slots[position] = { product, priceInCents }
    }
  }
  return slots
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export const formatValidUntil = (validUntil: string | null) => {
  const match = validUntil ? ISO_DATE_PATTERN.exec(validUntil) : null
  if (!match) return null
  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}
