import { describe, expect, test } from 'vitest'

import {
  addPage,
  canSwapSlots,
  clearOfferPrices,
  clearOfferProducts,
  clearPageProducts,
  countProducts,
  createOfferContent,
  createOfferPage,
  dropMissingProducts,
  findEmptySlot,
  findOtherPagesWithProduct,
  findPageWithoutPrice,
  findProductPrice,
  formatPrice,
  formatValidUntil,
  getPageConflict,
  isOfferContent,
  isOfferSnapshot,
  isSameOfferSnapshot,
  movePage,
  moveSlot,
  moveSlotToNewPage,
  moveSlotToPage,
  type OfferContent,
  type OfferItem,
  type OfferSlot,
  parsePrice,
  placeSlots,
  removePage,
  replaceProduct,
  setProductPrice,
  setSlot,
  toOfferSnapshot
} from '@/domain/offer'
import { PAGE_PRODUCT_COUNT } from '@/domain/poster'

const emptySlots = Array.from({ length: PAGE_PRODUCT_COUNT }, () => null)

const item: OfferItem = {
  product: {
    id: '0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d',
    codes: ['1234'],
    name: 'Picanha bovina',
    brand: null,
    unit: 'Kg',
    voiceText: null,
    photo: null
  },
  priceInCents: 6990
}

describe('createOfferContent', () => {
  test('starts with one page with every slot empty', () => {
    const { pages } = createOfferContent('mercado')

    expect(pages).toHaveLength(1)
    expect(pages[0].templateId).toBe('mercado')
    expect(pages[0].slots).toEqual(emptySlots)
  })
})

describe('placeSlots', () => {
  test('keeps each item at its position and the gaps empty', () => {
    const slots = placeSlots([
      { ...item, position: 4 },
      { ...item, position: 0 }
    ])

    expect(slots).toHaveLength(PAGE_PRODUCT_COUNT)
    expect(slots[0]).toEqual(item)
    expect(slots[4]).toEqual(item)
    expect(slots.filter(Boolean)).toHaveLength(2)
  })

  test('drops items outside the page', () => {
    const slots = placeSlots([
      { ...item, position: PAGE_PRODUCT_COUNT },
      { ...item, position: -1 }
    ])

    expect(slots).toEqual(emptySlots)
  })
})

describe('formatValidUntil', () => {
  test('formats an ISO date as day/month/year', () => {
    expect(formatValidUntil('2026-10-20')).toBe('20/10/2026')
  })

  test.each([null, '', '20/10/2026'])('returns null for %j', (value) => {
    expect(formatValidUntil(value)).toBe(null)
  })
})

describe('addPage', () => {
  test('repeats the template and layout of the last page', () => {
    const last = { ...createOfferPage('acougue'), layout: 4 as const }
    const pages = addPage([createOfferPage('mercado'), last], 'mercado')

    expect(pages).toHaveLength(3)
    expect(pages[2]).toEqual({ ...last, slots: emptySlots })
  })

  test('uses the given template when there is no page', () => {
    expect(addPage([], 'mercado')).toEqual([createOfferPage('mercado')])
  })
})

describe('removePage', () => {
  test('removes the page at the index', () => {
    const pages = [createOfferPage('a'), createOfferPage('b')]

    expect(removePage(pages, 0)).toEqual([pages[1]])
  })

  test('keeps the last page, since an offer has at least one', () => {
    const pages = [createOfferPage('a')]

    expect(removePage(pages, 0)).toBe(pages)
  })
})

describe('movePage', () => {
  const pages = ['a', 'b', 'c'].map((id) => createOfferPage(id))
  const ids = (moved: typeof pages) => moved.map((page) => page.templateId)

  test.each([
    [0, 2, ['b', 'c', 'a']],
    [2, 0, ['c', 'a', 'b']],
    [1, 2, ['a', 'c', 'b']]
  ])('moves page %i to %i', (from, to, expected) => {
    expect(ids(movePage(pages, from, to))).toEqual(expected)
  })

  test.each([-1, 3])('ignores a move to %i, outside the list', (to) => {
    expect(movePage(pages, 0, to)).toBe(pages)
  })
})

describe('moveSlot', () => {
  const other = { ...item, priceInCents: 500 }
  const page = setSlot(setSlot(createOfferPage('mercado'), 0, item), 1, other)

  test('swaps two filled slots', () => {
    const moved = moveSlot(page, 0, 1)
    expect(moved.slots[0]).toBe(other)
    expect(moved.slots[1]).toBe(item)
  })

  test('moves into an empty slot and leaves the old one empty', () => {
    const moved = moveSlot(page, 1, 2)
    expect(moved.slots[1]).toBeNull()
    expect(moved.slots[2]).toBe(other)
  })

  test.each([-1, 9])('ignores a move to %i, outside the slots', (to) => {
    expect(moveSlot(page, 0, to)).toBe(page)
  })

  test('ignores a move past the slots the layout shows', () => {
    const small = { ...page, layout: 3 as const }
    expect(moveSlot(small, 2, 3)).toBe(small)
  })
})

const productWith = (id: string, ...codes: string[]) => ({
  product: { ...item.product, id, codes },
  priceInCents: 500
})

const pageWith = (...items: OfferItem[]) => ({
  ...createOfferPage('mercado'),
  slots: placeSlots(items.map((slot, position) => ({ ...slot, position })))
})

describe('moving a product between pages', () => {
  const lavender = productWith('lavender', '111')
  const rose = productWith('rose', '222')
  const group = productWith('group', '111', '222')

  describe('getPageConflict', () => {
    test('finds a product with exactly the same codes, in any order', () => {
      const page = pageWith(group)
      const product = { ...group.product, id: 'x', codes: ['222', '111'] }
      expect(getPageConflict(page, product)).toBe('same-product')
    })

    test('tells a product that only shares a code, like a group and its variation', () => {
      expect(getPageConflict(pageWith(group), lavender.product)).toBe(
        'shared-code'
      )
      expect(getPageConflict(pageWith(lavender), group.product)).toBe(
        'shared-code'
      )
    })

    test('lets separate variations of a product share the page', () => {
      expect(getPageConflict(pageWith(lavender), rose.product)).toBeNull()
    })

    test('looks at the slots past the layout', () => {
      const page = {
        ...setSlot(createOfferPage('m'), 8, rose),
        layout: 3 as const
      }
      expect(getPageConflict(page, rose.product)).toBe('same-product')
    })
  })

  describe('findEmptySlot', () => {
    test('finds the first empty slot', () => {
      const page = setSlot(pageWith(lavender, rose), 0, null)
      expect(findEmptySlot(page)).toBe(0)
    })

    test('ignores an empty slot past the layout', () => {
      const page = {
        ...pageWith(lavender, rose, group),
        layout: 3 as const
      }
      expect(findEmptySlot(page)).toBe(-1)
    })
  })

  describe('moveSlotToPage', () => {
    test('moves the product and its price into an empty slot', () => {
      const pages = [pageWith(lavender), pageWith(rose)]
      const moved = moveSlotToPage(
        pages,
        { page: 0, position: 0 },
        { page: 1, position: 1 }
      )
      expect(moved[0].slots[0]).toBeNull()
      expect(moved[1].slots[0]).toEqual(rose)
      expect(moved[1].slots[1]).toEqual(lavender)
    })

    test('trades places with the product in the slot', () => {
      const pages = [pageWith(lavender), pageWith(rose)]
      const moved = moveSlotToPage(
        pages,
        { page: 0, position: 0 },
        { page: 1, position: 0 }
      )
      expect(moved[0].slots[0]).toEqual(rose)
      expect(moved[1].slots[0]).toEqual(lavender)
    })

    test('ignores a move within the same page', () => {
      const pages = [pageWith(lavender, rose)]
      expect(
        moveSlotToPage(
          pages,
          { page: 0, position: 0 },
          { page: 0, position: 1 }
        )
      ).toBe(pages)
    })
  })

  describe('moveSlotToNewPage', () => {
    test('adds a page like the last one holding only the product', () => {
      const last = {
        ...pageWith(rose),
        templateId: 'festa',
        layout: 4 as const
      }
      const moved = moveSlotToNewPage(
        [pageWith(lavender), last],
        { page: 0, position: 0 },
        'mercado'
      )
      expect(moved).toHaveLength(3)
      expect(moved[0].slots[0]).toBeNull()
      expect(moved[1]).toBe(last)
      expect(moved[2].templateId).toBe('festa')
      expect(moved[2].layout).toBe(4)
      expect(moved[2].slots[0]).toEqual(lavender)
      expect(moved[2].slots.filter(Boolean)).toHaveLength(1)
    })
  })

  describe('canSwapSlots', () => {
    const from = { page: 0, position: 0 }
    const to = { page: 1, position: 0 }

    test('allows different products', () => {
      expect(canSwapSlots([pageWith(lavender), pageWith(rose)], from, to)).toBe(
        true
      )
    })

    test('refuses trading a product for itself', () => {
      expect(
        canSwapSlots([pageWith(lavender), pageWith(lavender)], from, to)
      ).toBe(false)
    })

    test('refuses bringing a product its page already has', () => {
      expect(
        canSwapSlots([pageWith(lavender, rose), pageWith(rose)], from, to)
      ).toBe(false)
    })

    test('refuses taking a product to a page that already has it', () => {
      expect(
        canSwapSlots([pageWith(lavender), pageWith(rose, lavender)], from, to)
      ).toBe(false)
    })

    test('allows trading a group for one of its variations', () => {
      expect(canSwapSlots([pageWith(group), pageWith(rose)], from, to)).toBe(
        true
      )
    })
  })
})

describe('setSlot', () => {
  test('fills one slot and keeps the others', () => {
    const page = setSlot(createOfferPage('mercado'), 3, item)

    expect(page.slots[3]).toEqual(item)
    expect(page.slots.filter(Boolean)).toHaveLength(1)
  })
})

describe('replaceProduct', () => {
  test('updates the product in every slot of every page and keeps the prices', () => {
    const other: OfferItem = {
      product: { ...item.product, id: 'e1d2c3b4-a5f6-4789-8abc-def012345678' },
      priceInCents: 1990
    }
    const pages = [
      setSlot(setSlot(createOfferPage('a'), 0, item), 1, other),
      setSlot(createOfferPage('a'), 4, { ...item, priceInCents: 5990 })
    ]
    const edited = { ...item.product, name: 'Picanha maturada' }

    const [first, second] = replaceProduct(pages, edited)

    expect(first.slots[0]).toEqual({ product: edited, priceInCents: 6990 })
    expect(first.slots[1]).toBe(other)
    expect(second.slots[4]).toEqual({ product: edited, priceInCents: 5990 })
    expect(second.slots[0]).toBeNull()
  })
})

describe('sharing a price across the offer', () => {
  const group: OfferItem = {
    product: {
      ...item.product,
      id: '7a1e2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b',
      codes: ['1234', '5678']
    },
    priceInCents: 4990
  }
  const slots: OfferSlot[] = emptySlots
  const pages = [
    { ...createOfferPage('mercado'), slots: slots.with(0, item) },
    {
      ...createOfferPage('mercado'),
      layout: 4 as const,
      slots: slots.with(1, group).with(6, { ...item, priceInCents: 7990 })
    }
  ]

  test('sets the price of every slot with the product, past the layout too', () => {
    const next = setProductPrice(pages, item.product.id, 5990)

    expect(next[0].slots[0]?.priceInCents).toBe(5990)
    expect(next[1].slots[6]?.priceInCents).toBe(5990)
  })

  test('keeps the price of a product that only shares a code', () => {
    const next = setProductPrice(pages, item.product.id, 5990)

    expect(next[1].slots[1]).toBe(group)
  })

  test('brings the price of the first slot with the product', () => {
    expect(findProductPrice(pages, item.product.id)).toBe(6990)
    expect(findProductPrice(pages, group.product.id)).toBe(4990)
  })

  test('brings no price from a slot past the layout', () => {
    expect(findProductPrice(pages.slice(1), item.product.id)).toBe(0)
  })

  test('brings no price for a product the offer lacks', () => {
    expect(
      findProductPrice([createOfferPage('mercado')], item.product.id)
    ).toBe(0)
  })

  test('lists the other pages that show the product', () => {
    const shown = pages.with(1, { ...pages[1], layout: 9 })

    expect(findOtherPagesWithProduct(shown, item.product.id, 0)).toEqual([1])
    expect(findOtherPagesWithProduct(shown, item.product.id, 1)).toEqual([0])
  })

  test('leaves out a page that only holds the product past the layout', () => {
    expect(findOtherPagesWithProduct(pages, item.product.id, 0)).toEqual([])
  })
})

describe('parsePrice', () => {
  test.each([
    ['12,90', 1290],
    ['12.9', 1290],
    ['12', 1200],
    ['R$ 0,29', 29],
    ['1.234,56', 123_456]
  ])('reads %j as %i cents', (text, cents) => {
    expect(parsePrice(text)).toBe(cents)
  })

  test.each(['', 'abc', '12,999', '-1', '1.234'])(
    'returns null for %j',
    (text) => {
      expect(parsePrice(text)).toBe(null)
    }
  )
})

describe('formatPrice', () => {
  test.each([
    [1290, '12,90'],
    [5, '0,05'],
    [123_456, '1234,56']
  ])('formats %i cents as %j', (cents, text) => {
    expect(formatPrice(cents)).toBe(text)
  })
})

describe('isOfferContent', () => {
  const content = {
    ...createOfferContent('mercado'),
    validUntil: '2026-10-20',
    pages: [setSlot(createOfferPage('mercado'), 0, item)]
  }

  test('accepts the content of the editor', () => {
    expect(isOfferContent(content)).toBe(true)
  })

  test.each([
    ['a validity outside ISO', { ...content, validUntil: '20/10/2026' }],
    ['no page', { ...content, pages: [] }],
    [
      'an unknown layout',
      { ...content, pages: [{ ...content.pages[0], layout: 5 }] }
    ],
    [
      'a page with missing slots',
      { ...content, pages: [{ ...content.pages[0], slots: [] }] }
    ],
    [
      'a negative price',
      {
        ...content,
        pages: [setSlot(content.pages[0], 0, { ...item, priceInCents: -1 })]
      }
    ],
    [
      'a code that could leave the photos folder',
      {
        ...content,
        pages: [
          setSlot(content.pages[0], 0, {
            ...item,
            product: { ...item.product, codes: ['../x'] }
          })
        ]
      }
    ],
    [
      'a product id that is not a UUID',
      {
        ...content,
        pages: [
          setSlot(content.pages[0], 0, {
            ...item,
            product: { ...item.product, id: '1234' }
          })
        ]
      }
    ]
  ])('rejects %s', (_case, value) => {
    expect(isOfferContent(value)).toBe(false)
  })
})

describe('findPageWithoutPrice', () => {
  test('returns the first page with a product still at zero', () => {
    const pages = [
      setSlot(createOfferPage('a'), 0, item),
      setSlot(createOfferPage('a'), 8, { ...item, priceInCents: 0 })
    ]

    expect(findPageWithoutPrice(pages)).toBe(1)
  })

  test('returns -1 when every product has a price', () => {
    const pages = [setSlot(createOfferPage('a'), 0, item)]

    expect(findPageWithoutPrice(pages)).toBe(-1)
  })
})

const filled = (): OfferContent => {
  const content = createOfferContent('mercado')
  // The layout hides the second product, which would come back if the layout grew again
  content.pages[0].layout = 3
  content.pages[0].slots[0] = item
  content.pages[0].slots[5] = item
  return { ...content, validUntil: '2026-11-12', highlightTitle: 'Feirão' }
}

describe('clearing the offer', () => {
  test('clearOfferProducts empties every slot and the validity, keeping the rest', () => {
    const cleared = clearOfferProducts(filled())

    expect(countProducts(cleared.pages)).toBe(0)
    expect(cleared.validUntil).toBe(null)
    expect(cleared.highlightTitle).toBe('Feirão')
    expect(cleared.pages[0].layout).toBe(3)
  })

  test('clearPageProducts empties the slots past the layout too, keeping the page settings', () => {
    const [page] = filled().pages
    const cleared = clearPageProducts(page)

    expect(countProducts([cleared])).toBe(0)
    expect(cleared.layout).toBe(3)
    expect(cleared.templateId).toBe(page.templateId)
  })

  test('clearing one page leaves the other pages and the offer texts intact', () => {
    const content = filled()
    const other = setSlot(createOfferPage('mercado'), 0, item)
    const pages = [content.pages[0], other]
    const cleared = {
      ...content,
      pages: pages.with(0, clearPageProducts(pages[0]))
    }

    expect(countProducts([cleared.pages[0]])).toBe(0)
    expect(cleared.pages[1]).toBe(other)
    expect(cleared.validUntil).toBe('2026-11-12')
    expect(cleared.highlightTitle).toBe('Feirão')
  })

  test('clearOfferPrices keeps the products without price or validity', () => {
    const cleared = clearOfferPrices(filled())

    expect(cleared.pages[0].slots[0]).toEqual({ ...item, priceInCents: 0 })
    expect(cleared.pages[0].slots[5]).toEqual({ ...item, priceInCents: 0 })
    expect(cleared.pages[0].slots[1]).toBe(null)
    expect(cleared.validUntil).toBe(null)
  })

  test('findPageWithoutPrice ignores a product the layout hides', () => {
    const { pages } = clearOfferPrices(filled())

    expect(findPageWithoutPrice(pages)).toBe(0)
    expect(
      findPageWithoutPrice([
        { ...pages[0], slots: pages[0].slots.with(0, null) }
      ])
    ).toBe(-1)
  })
})

describe('offer snapshots', () => {
  test('toOfferSnapshot keeps each product by id in its position, past the layout too', () => {
    const snapshot = toOfferSnapshot(filled())

    expect(snapshot.pages[0].items).toEqual([
      {
        position: 0,
        productId: item.product.id,
        priceInCents: item.priceInCents
      },
      {
        position: 5,
        productId: item.product.id,
        priceInCents: item.priceInCents
      }
    ])
    expect(isOfferSnapshot(snapshot)).toBe(true)
  })

  test('isSameOfferSnapshot tells apart a change of price, position or text', () => {
    const content = filled()
    const snapshot = toOfferSnapshot(content)
    const [page] = content.pages
    const isSame = (other: OfferContent) =>
      isSameOfferSnapshot(snapshot, toOfferSnapshot(other))

    expect(isSame(filled())).toBe(true)
    expect(isSame(clearOfferPrices(content))).toBe(false)
    const reversed = { ...page, slots: page.slots.toReversed() }
    expect(isSame({ ...content, pages: [reversed] })).toBe(false)
    expect(isSame({ ...content, highlightTitle: 'Outro' })).toBe(false)
  })

  test('dropMissingProducts empties the slots of deleted products and counts them', () => {
    const { snapshot, missingProductCount } = dropMissingProducts(
      toOfferSnapshot(filled()),
      new Set()
    )

    expect(missingProductCount).toBe(2)
    expect(snapshot.pages[0].items).toEqual([])
    expect(snapshot.validUntil).toBe('2026-11-12')
  })

  test('isOfferSnapshot refuses an offer with no pages or a slot past the page', () => {
    const snapshot = toOfferSnapshot(filled())

    expect(isOfferSnapshot({ ...snapshot, pages: [] })).toBe(false)
    expect(
      isOfferSnapshot({
        ...snapshot,
        pages: [
          {
            ...snapshot.pages[0],
            items: [{ ...snapshot.pages[0].items[0], position: 9 }]
          }
        ]
      })
    ).toBe(false)
  })
})
