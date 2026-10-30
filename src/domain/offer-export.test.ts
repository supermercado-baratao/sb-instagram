import { describe, expect, test } from 'vitest'

import {
  createOfferContent,
  createOfferPage,
  type OfferItem,
  type OfferPage,
  setSlot
} from '@/domain/offer'
import { getOfferExport } from '@/domain/offer-export'

const item = (name: string, priceInCents: number): OfferItem => ({
  product: {
    id: '0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d',
    codes: ['7891000100103', '1234'],
    name,
    brand: 'Marca',
    unit: '500g',
    voiceText: null,
    photo: 'foto.png'
  },
  priceInCents
})

describe('getOfferExport', () => {
  test('lists the filled slots of each page in order, with the price as text', () => {
    const first = setSlot(
      setSlot(createOfferPage('mercado'), 2, item('Café', 1075)),
      0,
      item('Arroz', 2990)
    )
    const second = setSlot(
      createOfferPage('mercado'),
      1,
      item('Detergente', 158)
    )
    const content = {
      ...createOfferContent('mercado'),
      validUntil: '2026-10-24',
      pages: [first, second]
    }

    expect(getOfferExport(content)).toEqual({
      version: 1,
      name: 'Nova oferta',
      validUntil: '2026-10-24',
      highlightTitle: 'Ofertas da semana',
      highlightMessage: 'Só nesta loja',
      pages: [
        {
          number: 1,
          products: [
            {
              name: 'Arroz',
              brand: 'Marca',
              unit: '500g',
              codes: ['7891000100103', '1234'],
              price: '29,90'
            },
            {
              name: 'Café',
              brand: 'Marca',
              unit: '500g',
              codes: ['7891000100103', '1234'],
              price: '10,75'
            }
          ]
        },
        {
          number: 2,
          products: [
            {
              name: 'Detergente',
              brand: 'Marca',
              unit: '500g',
              codes: ['7891000100103', '1234'],
              price: '1,58'
            }
          ]
        }
      ]
    })
  })

  test('leaves out the slots the layout hides', () => {
    const page: OfferPage = { ...createOfferPage('mercado'), layout: 4 }
    const filled = setSlot(
      setSlot(page, 3, item('Arroz', 2990)),
      4,
      item('Feijão', 899)
    )

    const { pages } = getOfferExport({
      ...createOfferContent('mercado'),
      pages: [filled]
    })

    expect(pages[0].products.map(({ name }) => name)).toEqual(['Arroz'])
  })

  test('keeps a page with no products, so the numbers match the poster pages', () => {
    const { pages } = getOfferExport(createOfferContent('mercado'))

    expect(pages).toEqual([{ number: 1, products: [] }])
  })
})
