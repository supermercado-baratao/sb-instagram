import {
  DEFAULT_POSTER_LAYOUT,
  isPosterLayout,
  PAGE_PRODUCT_COUNT,
  type PosterLayout
} from '@/domain/poster'
import { isValidCode, isValidProductId, type Product } from '@/domain/product'

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

export const addPage = (pages: OfferPage[], templateId: string) => {
  const last = pages.at(-1)
  return [
    ...pages,
    {
      ...createOfferPage(last?.templateId ?? templateId),
      layout: last?.layout ?? DEFAULT_POSTER_LAYOUT
    }
  ]
}

// Generic so the editor can apply the same change to the keys it keeps for each page
export const removePage = <T>(pages: T[], index: number) =>
  pages.length > 1 ? pages.toSpliced(index, 1) : pages

export const movePage = <T>(pages: T[], from: number, to: number) => {
  if (from === to || to < 0 || to >= pages.length) return pages
  const moved = pages.toSpliced(from, 1)
  return moved.toSpliced(to, 0, pages[from])
}

export const setSlot = (
  page: OfferPage,
  position: number,
  slot: OfferSlot
): OfferPage => ({ ...page, slots: page.slots.with(position, slot) })

export const replaceProduct = (
  pages: OfferPage[],
  product: Product
): OfferPage[] =>
  pages.map((page) => ({
    ...page,
    slots: page.slots.map((slot) =>
      slot?.product.id === product.id ? { ...slot, product } : slot
    )
  }))

const PRICE_PATTERN = /^\d+(?:[.,]\d{1,2})?$/

// Accepts what a cashier types ("12,90", "12.9", "12"), with or without "R$" and thousands dots
export const parsePrice = (text: string) => {
  let value = text.replaceAll(/\s|R\$/gi, '')
  if (value.includes(',')) value = value.replaceAll('.', '')
  if (!PRICE_PATTERN.test(value)) return null
  return Math.round(Number(value.replace(',', '.')) * 100)
}

export const formatPrice = (priceInCents: number) =>
  `${Math.trunc(priceInCents / 100)},${String(priceInCents % 100).padStart(2, '0')}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isOptionalText = (value: unknown) =>
  value === null || typeof value === 'string'

const isProduct = (value: unknown): value is Product =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  isValidProductId(value.id) &&
  Array.isArray(value.codes) &&
  value.codes.every((code) => typeof code === 'string' && isValidCode(code)) &&
  typeof value.name === 'string' &&
  isOptionalText(value.brand) &&
  isOptionalText(value.unit) &&
  isOptionalText(value.photo)

const isSlot = (value: unknown): value is OfferSlot =>
  value === null ||
  (isRecord(value) &&
    isProduct(value.product) &&
    Number.isSafeInteger(value.priceInCents) &&
    (value.priceInCents as number) >= 0)

const isPage = (value: unknown): value is OfferPage =>
  isRecord(value) &&
  typeof value.templateId === 'string' &&
  isPosterLayout(value.layout) &&
  Array.isArray(value.slots) &&
  value.slots.length === PAGE_PRODUCT_COUNT &&
  value.slots.every(isSlot)

// A Server Action is a public endpoint, so the editor's content is checked again on the server
export const isOfferContent = (value: unknown): value is OfferContent =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  value.name.trim() !== '' &&
  (value.validUntil === null ||
    (typeof value.validUntil === 'string' &&
      ISO_DATE_PATTERN.test(value.validUntil))) &&
  typeof value.highlightTitle === 'string' &&
  typeof value.highlightMessage === 'string' &&
  Array.isArray(value.pages) &&
  value.pages.length > 0 &&
  value.pages.every(isPage)

// A product placed on a page starts without a price, which the poster would print as R$ 0,00
export const findPageWithoutPrice = (pages: OfferPage[]) =>
  pages.findIndex((page) =>
    page.slots.some((slot) => slot !== null && slot.priceInCents === 0)
  )
