import { describe, expect, test } from 'vitest'

import {
  createOfferContent,
  formatValidUntil,
  type OfferItem,
  placeSlots
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
