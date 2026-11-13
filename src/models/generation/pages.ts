import {
  createOfferPage,
  type OfferContent,
  type OfferPage,
  parsePrice,
  setSlot
} from '@/models/offer/offer'
import {
  DEFAULT_POSTER_LAYOUT,
  PAGE_PRODUCT_COUNT,
  type PosterLayout,
  posterLayouts
} from '@/models/poster/poster'
import { normalizeCodes, type Product } from '@/models/product/product'

import {
  exportPagesSchema,
  type GenerationPage,
  type GenerationPageItem
} from './schema'

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
  const parsed = exportPagesSchema.safeParse(exported)
  if (!parsed.success) return
  const pages: GenerationPage[] = []
  for (const page of parsed.data.pages) {
    const items: GenerationPageItem[] = []
    for (const product of page.products.slice(0, PAGE_PRODUCT_COUNT)) {
      const priceInCents = parsePrice(product.price)
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
