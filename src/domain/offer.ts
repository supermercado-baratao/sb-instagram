import {
  DEFAULT_POSTER_LAYOUT,
  isPosterLayout,
  PAGE_PRODUCT_COUNT,
  type PosterLayout
} from '@/domain/poster'
import {
  isSameCodeSet,
  isValidCode,
  type Product
} from '@/models/product/product'
import { isProductId } from '@/models/product/schema'

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
  // ISO date (YYYY-MM-DD), the value of a date input
  validUntil: string | null
  highlightTitle: string
  highlightMessage: string
  pages: OfferPage[]
}

export const createOfferPage = (templateId: string): OfferPage => ({
  templateId,
  layout: DEFAULT_POSTER_LAYOUT,
  slots: Array.from({ length: PAGE_PRODUCT_COUNT }, () => null)
})

export const createOfferContent = (templateId: string): OfferContent => ({
  validUntil: null,
  highlightTitle: 'Ofertas da semana',
  highlightMessage: 'Só nesta loja',
  pages: [createOfferPage(templateId)]
})

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

// Swaps with the slot already there, so the grid keeps its gaps and nothing else shifts. Crosses the
// layout freely, so a product left out of the poster can come back in (#117)
export const moveSlot = (
  page: OfferPage,
  from: number,
  to: number
): OfferPage => {
  if (from === to || to < 0 || to >= page.slots.length) return page
  return {
    ...page,
    slots: page.slots.with(from, page.slots[to]).with(to, page.slots[from])
  }
}

export type SlotMoveDirection = 'before' | 'after'

// Past the layout only filled slots are on screen, so a move there skips the empty ones and never
// lands a product somewhere the store can't see (#121)
export const getSlotMoveTarget = (
  page: OfferPage,
  from: number,
  direction: SlotMoveDirection
): number | null => {
  const filledOutside = page.slots
    .map((slot, position) => (slot && position >= page.layout ? position : -1))
    .filter((position) => position >= 0)
  if (direction === 'after') {
    if (from < page.layout)
      return from + 1 < page.slots.length ? from + 1 : null
    return filledOutside.find((position) => position > from) ?? null
  }
  if (from <= page.layout) return from > 0 ? from - 1 : null
  return (
    filledOutside.findLast((position) => position < from) ?? page.layout - 1
  )
}

export type SlotLocation = {
  page: number
  position: number
}

export type PageConflict = 'same-product' | 'shared-code' | null

// Compares the whole set of codes: variations of a product are registered apart (#55), so a single
// fragrance and a group holding it only share a code, and the store may place both on purpose.
// Looks past the layout too, since a hidden slot comes back if the layout grows
export const getPageConflict = (
  page: OfferPage,
  product: Product
): PageConflict => {
  const placed = page.slots.flatMap((slot) => (slot ? [slot.product] : []))
  if (placed.some(({ codes }) => isSameCodeSet(codes, product.codes))) {
    return 'same-product'
  }
  return placed.some(({ codes }) =>
    codes.some((code) => product.codes.includes(code))
  )
    ? 'shared-code'
    : null
}

// A hidden slot isn't free: the layout may grow and bring its product back
export const findEmptySlot = (page: OfferPage) =>
  page.slots.slice(0, page.layout).indexOf(null)

// Swaps, so moving into an empty slot and trading places with a product are the same operation
export const moveSlotToPage = (
  pages: OfferPage[],
  from: SlotLocation,
  to: SlotLocation
): OfferPage[] => {
  if (from.page === to.page) return pages
  const source = pages[from.page]
  const target = pages[to.page]
  return pages
    .with(from.page, setSlot(source, from.position, target.slots[to.position]))
    .with(to.page, setSlot(target, to.position, source.slots[from.position]))
}

export const moveSlotToNewPage = (
  pages: OfferPage[],
  from: SlotLocation,
  templateId: string
): OfferPage[] =>
  moveSlotToPage(addPage(pages, templateId), from, {
    page: pages.length,
    position: 0
  })

// The product stays where it is, with the price it has across the offer (#93)
export const copySlotToPage = (
  pages: OfferPage[],
  from: SlotLocation,
  to: SlotLocation
): OfferPage[] => {
  const copied = pages[from.page].slots[from.position]
  if (!copied || from.page === to.page) return pages
  return pages.with(to.page, setSlot(pages[to.page], to.position, copied))
}

export const copySlotToNewPage = (
  pages: OfferPage[],
  from: SlotLocation,
  templateId: string
): OfferPage[] =>
  copySlotToPage(addPage(pages, templateId), from, {
    page: pages.length,
    position: 0
  })

// Each product must not already be on the page it goes to. Checking the pages as they are also
// refuses trading a product for itself
export const canSwapSlots = (
  pages: OfferPage[],
  from: SlotLocation,
  to: SlotLocation
) => {
  const moved = pages[from.page].slots[from.position]
  const other = pages[to.page].slots[to.position]
  return (
    moved !== null &&
    other !== null &&
    getPageConflict(pages[to.page], moved.product) !== 'same-product' &&
    getPageConflict(pages[from.page], other.product) !== 'same-product'
  )
}

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

// The price belongs to the product across the whole offer (#93), so the same product never goes out
// with two prices. Reaches the slots past the layout too, which come back if the layout grows
export const setProductPrice = (
  pages: OfferPage[],
  productId: string,
  priceInCents: number
): OfferPage[] =>
  pages.map((page) => ({
    ...page,
    slots: page.slots.map((slot) =>
      slot?.product.id === productId ? { ...slot, priceInCents } : slot
    )
  }))

// Only a slot the layout shows lends its price, like the notice under the price field, so a price
// never comes in unexplained. The first one wins, since an offer saved before #93 may hold two
export const findProductPrice = (pages: OfferPage[], productId: string) =>
  pages
    .flatMap((page) => page.slots.slice(0, page.layout))
    .find((slot) => slot?.product.id === productId)?.priceInCents ?? 0

export const findOtherPagesWithProduct = (
  pages: OfferPage[],
  productId: string,
  pageIndex: number
) =>
  pages.flatMap((page, index) =>
    index !== pageIndex &&
    page.slots
      .slice(0, page.layout)
      .some((slot) => slot?.product.id === productId)
      ? [index]
      : []
  )

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
  isProductId(value.id) &&
  Array.isArray(value.codes) &&
  value.codes.every((code) => typeof code === 'string' && isValidCode(code)) &&
  typeof value.description === 'string' &&
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
  (value.validUntil === null ||
    (typeof value.validUntil === 'string' &&
      ISO_DATE_PATTERN.test(value.validUntil))) &&
  typeof value.highlightTitle === 'string' &&
  typeof value.highlightMessage === 'string' &&
  Array.isArray(value.pages) &&
  value.pages.length > 0 &&
  value.pages.every(isPage)

// A product placed on a page starts without a price, which the poster would print as R$ 0,00. A
// slot past the layout isn't printed, and asks again if the layout grows back
export const findPageWithoutPrice = (pages: OfferPage[]) =>
  pages.findIndex((page) =>
    page.slots
      .slice(0, page.layout)
      .some((slot) => slot !== null && slot.priceInCents === 0)
  )

const mapSlots = (
  pages: OfferPage[],
  map: (slot: OfferItem) => OfferSlot
): OfferPage[] =>
  pages.map((page) => ({
    ...page,
    slots: page.slots.map((slot) => slot && map(slot))
  }))

// Counts the slots past the layout too, since clearing them keeps old data from coming back
export const countProducts = (pages: OfferPage[]) =>
  pages.flatMap((page) => page.slots).filter((slot) => slot !== null).length

export const clearOfferProducts = (content: OfferContent): OfferContent => ({
  ...content,
  validUntil: null,
  pages: mapSlots(content.pages, () => null)
})

// Keeps the validity, which belongs to the whole offer and only a new week clears
export const clearPageProducts = (page: OfferPage): OfferPage => ({
  ...page,
  slots: page.slots.map(() => null)
})

export const clearOfferPrices = (content: OfferContent): OfferContent => ({
  ...content,
  validUntil: null,
  pages: mapSlots(content.pages, (slot) => ({ ...slot, priceInCents: 0 }))
})

export type OfferSnapshotItem = {
  position: number
  productId: string
  priceInCents: number
}

export type OfferSnapshotPage = {
  templateId: string
  layout: PosterLayout
  items: OfferSnapshotItem[]
}

// The offer as the database keeps it, with products by id, so a stored copy never goes stale
// when a product is edited
export type OfferSnapshot = Omit<OfferContent, 'pages'> & {
  pages: OfferSnapshotPage[]
}

export const toOfferSnapshot = (content: OfferContent): OfferSnapshot => ({
  validUntil: content.validUntil,
  highlightTitle: content.highlightTitle,
  highlightMessage: content.highlightMessage,
  pages: content.pages.map((page) => ({
    templateId: page.templateId,
    layout: page.layout,
    items: page.slots.flatMap((slot, position) =>
      slot
        ? [
            {
              position,
              productId: slot.product.id,
              priceInCents: slot.priceInCents
            }
          ]
        : []
    )
  }))
})

export const isSameOfferSnapshot = (a: OfferSnapshot, b: OfferSnapshot) =>
  a.validUntil === b.validUntil &&
  a.highlightTitle === b.highlightTitle &&
  a.highlightMessage === b.highlightMessage &&
  a.pages.length === b.pages.length &&
  a.pages.every((page, index) => {
    const other = b.pages[index]
    return (
      page.templateId === other.templateId &&
      page.layout === other.layout &&
      page.items.length === other.items.length &&
      page.items.every(
        (item, itemIndex) =>
          item.position === other.items[itemIndex].position &&
          item.productId === other.items[itemIndex].productId &&
          item.priceInCents === other.items[itemIndex].priceInCents
      )
    )
  })

const isSnapshotItem = (value: unknown): value is OfferSnapshotItem =>
  isRecord(value) &&
  Number.isSafeInteger(value.position) &&
  (value.position as number) >= 0 &&
  (value.position as number) < PAGE_PRODUCT_COUNT &&
  typeof value.productId === 'string' &&
  isProductId(value.productId) &&
  Number.isSafeInteger(value.priceInCents) &&
  (value.priceInCents as number) >= 0

const isSnapshotPage = (value: unknown): value is OfferSnapshotPage =>
  isRecord(value) &&
  typeof value.templateId === 'string' &&
  isPosterLayout(value.layout) &&
  Array.isArray(value.items) &&
  value.items.every(isSnapshotItem)

// The stored copy is JSON, so one written by a future version or edited by hand is never restored
export const isOfferSnapshot = (value: unknown): value is OfferSnapshot =>
  isRecord(value) &&
  isOptionalText(value.validUntil) &&
  typeof value.highlightTitle === 'string' &&
  typeof value.highlightMessage === 'string' &&
  Array.isArray(value.pages) &&
  value.pages.length > 0 &&
  value.pages.every(isSnapshotPage)

export const getSnapshotProductIds = (snapshot: OfferSnapshot) => [
  ...new Set(
    snapshot.pages.flatMap((page) => page.items.map((item) => item.productId))
  )
]

// A product deleted after the copy was stored leaves its slot empty
export const dropMissingProducts = (
  snapshot: OfferSnapshot,
  existingIds: ReadonlySet<string>
) => {
  let missingProductCount = 0
  const pages = snapshot.pages.map((page) => ({
    ...page,
    items: page.items.filter((item) => {
      if (existingIds.has(item.productId)) return true
      missingProductCount += 1
      return false
    })
  }))
  return { snapshot: { ...snapshot, pages }, missingProductCount }
}

export type OfferBackupSummary = {
  replacedAt: number
  pageCount: number
  productCount: number
  missingProductCount: number
}
