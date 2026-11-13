import {
  createOfferPage,
  type OfferContent,
  type OfferPage,
  parsePrice,
  setSlot
} from '@/models/offer/offer'
import {
  DEFAULT_POSTER_LAYOUT,
  isPosterLayout,
  PAGE_PRODUCT_COUNT,
  type PosterLayout,
  posterLayouts
} from '@/models/poster/poster'
import {
  isValidCode,
  normalizeCodes,
  type Product
} from '@/models/product/product'
import { isProductId } from '@/models/product/schema'

export type GenerationPageItem = {
  position: number
  // Null for a page rebuilt from the export of a generation recorded before #119
  productId: string | null
  // Kept beside the id, so a generation imported from another instance still finds its products
  codes: string[]
  priceInCents: number
}

export type GenerationPage = {
  // Null when rebuilt from an old export, which kept neither
  templateId: string | null
  layout: PosterLayout | null
  items: GenerationPageItem[]
}

// Only the slots the layout shows, like the PNG, so a copy brings back what was published
export const getGenerationPages = (content: OfferContent): GenerationPage[] =>
  content.pages.map((page) => ({
    templateId: page.templateId,
    layout: page.layout,
    items: page.slots.slice(0, page.layout).flatMap((slot, position) =>
      slot
        ? [
            {
              position,
              productId: slot.product.id,
              codes: slot.product.codes,
              priceInCents: slot.priceInCents
            }
          ]
        : []
    )
  }))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isCodeList = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((code) => typeof code === 'string' && isValidCode(code))

const isGenerationPageItem = (value: unknown): value is GenerationPageItem =>
  isRecord(value) &&
  Number.isSafeInteger(value.position) &&
  (value.position as number) >= 0 &&
  (value.position as number) < PAGE_PRODUCT_COUNT &&
  (value.productId === null ||
    (typeof value.productId === 'string' && isProductId(value.productId))) &&
  isCodeList(value.codes) &&
  Number.isSafeInteger(value.priceInCents) &&
  (value.priceInCents as number) >= 0

const isGenerationPage = (value: unknown): value is GenerationPage =>
  isRecord(value) &&
  (value.templateId === null || typeof value.templateId === 'string') &&
  (value.layout === null || isPosterLayout(value.layout)) &&
  Array.isArray(value.items) &&
  value.items.every(isGenerationPageItem)

// Read from the database or an imported archive, so a list written by a future version or edited
// by hand is never copied
export const isGenerationPages = (value: unknown): value is GenerationPage[] =>
  Array.isArray(value) && value.every(isGenerationPage)

const getSmallestLayout = (productCount: number): PosterLayout =>
  posterLayouts
    .map(({ id }) => id)
    .toSorted((a, b) => a - b)
    .find((layout) => layout >= productCount) ?? DEFAULT_POSTER_LAYOUT

// Every export version keeps each product's codes and price, in the order the poster shows them,
// but not the template, the layout nor the empty slots
export const getGenerationPagesFromExport = (
  exported: unknown
): GenerationPage[] | undefined => {
  if (!isRecord(exported) || !Array.isArray(exported.pages)) return
  const pages: GenerationPage[] = []
  for (const page of exported.pages) {
    if (!isRecord(page) || !Array.isArray(page.products)) return
    const items: GenerationPageItem[] = []
    for (const product of page.products.slice(0, PAGE_PRODUCT_COUNT)) {
      if (!isRecord(product) || !isCodeList(product.codes)) return
      const priceInCents =
        typeof product.price === 'string' ? parsePrice(product.price) : null
      if (priceInCents === null) return
      items.push({
        position: items.length,
        productId: null,
        codes: product.codes,
        priceInCents
      })
    }
    pages.push({
      templateId: null,
      layout: getSmallestLayout(items.length),
      items
    })
  }
  return pages
}

type ProductReference = Pick<GenerationPageItem, 'productId' | 'codes'>

export const resolveGenerationProduct = (
  item: ProductReference,
  findById: (id: string) => Product | undefined,
  findByCodes: (codes: string[]) => Product | undefined
) => {
  const byId = item.productId === null ? undefined : findById(item.productId)
  if (byId) return byId
  const codes = normalizeCodes(item.codes)
  return codes.length > 0 ? findByCodes(codes) : undefined
}

// A product keeps one price across the offer (#93): the price the offer already shows wins, and a
// product copied to several pages takes the first copied price
const collectShownPrices = (pages: OfferPage[]) => {
  const prices = new Map<string, number>()
  for (const page of pages) {
    for (const slot of page.slots.slice(0, page.layout)) {
      if (slot && !prices.has(slot.product.id)) {
        prices.set(slot.product.id, slot.priceInCents)
      }
    }
  }
  return prices
}

// Appended after the current pages, never replacing them. A product that no longer exists leaves
// its slot empty
export const appendGenerationPages = (
  content: OfferContent,
  pages: GenerationPage[],
  {
    templateIds,
    findProduct
  }: {
    templateIds: string[]
    findProduct: (item: ProductReference) => Product | undefined
  }
) => {
  const prices = collectShownPrices(content.pages)
  let missingProductCount = 0

  const copied = pages.map((page) => {
    const templateId =
      page.templateId !== null && templateIds.includes(page.templateId)
        ? page.templateId
        : templateIds[0]
    let offerPage: OfferPage = {
      ...createOfferPage(templateId),
      layout: page.layout ?? getSmallestLayout(page.items.length)
    }
    for (const item of page.items) {
      const product = findProduct(item)
      if (!product || offerPage.slots[item.position] !== null) {
        missingProductCount += 1
        continue
      }
      const priceInCents = prices.get(product.id) ?? item.priceInCents
      prices.set(product.id, priceInCents)
      offerPage = setSlot(offerPage, item.position, { product, priceInCents })
    }
    return offerPage
  })

  return {
    content: { ...content, pages: [...content.pages, ...copied] },
    missingProductCount
  }
}

// Page numbers come from the request, so each must name a page of the generation, once, in order
export const selectGenerationPages = (
  pages: GenerationPage[],
  pageNumbers: number[]
) => {
  const unique = [...new Set(pageNumbers)].toSorted((a, b) => a - b)
  if (
    unique.length === 0 ||
    unique.some(
      (pageNumber) =>
        !Number.isSafeInteger(pageNumber) ||
        pageNumber < 1 ||
        pageNumber > pages.length
    )
  ) {
    return
  }
  return unique.map((pageNumber) => pages[pageNumber - 1])
}
