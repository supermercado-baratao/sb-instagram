import { describe, expect, test } from 'vitest'

import {
  addPage,
  createOfferContent,
  createOfferPage,
  findPageWithoutPrice,
  formatPrice,
  formatValidUntil,
  isOfferContent,
  movePage,
  type OfferItem,
  parsePrice,
  placeSlots,
  removePage,
  setSlot
} from '@/domain/offer'
import { PAGE_PRODUCT_COUNT } from '@/domain/poster'

const emptySlots = Array.from({ length: PAGE_PRODUCT_COUNT }, () => null)

const item: OfferItem = {
  product: {
    code: '1234',
    codeType: 'internal',
    name: 'Picanha bovina',
    brand: null,
    unit: 'Kg',
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

describe('setSlot', () => {
  test('fills one slot and keeps the others', () => {
    const page = setSlot(createOfferPage('mercado'), 3, item)

    expect(page.slots[3]).toEqual(item)
    expect(page.slots.filter(Boolean)).toHaveLength(1)
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
    ['an empty name', { ...content, name: '  ' }],
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
            product: { ...item.product, code: '../x' }
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
