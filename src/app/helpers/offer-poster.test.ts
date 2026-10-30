import { describe, expect, test } from 'vitest'

import {
  getPosterOffer,
  getPosterProducts,
  VALIDITY_PLACEHOLDER
} from '@/app/helpers/offer-poster'
import { createOfferContent } from '@/domain/offer'
import { HIDDEN_FIELD_MARKER } from '@/domain/poster'
import type { Product } from '@/domain/product'

const product: Product = {
  id: '0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d',
  codes: ['7891000100103'],
  name: 'Leite integral',
  brand: 'Italac',
  unit: '1L',
  voiceText: null,
  photo: '7891000100103.png'
}

describe('getPosterProducts', () => {
  test('points the image to the store photo route', () => {
    const [poster] = getPosterProducts([{ product, priceInCents: 549 }])

    expect(poster).toMatchObject({
      name: 'Leite integral',
      brand: 'Italac',
      unit: '1L',
      image: '/fotos/0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d',
      priceInCents: 549
    })
  })

  test('hides the brand line of a product without brand', () => {
    const [poster] = getPosterProducts([
      { product: { ...product, brand: null, photo: null }, priceInCents: 549 }
    ])

    expect(poster.brand).toBe(HIDDEN_FIELD_MARKER)
    expect(poster.image).toBe(null)
  })

  test('turns an empty slot into a blank product', () => {
    expect(getPosterProducts([null])[0]).toMatchObject({
      name: '',
      brand: '',
      unit: '',
      image: null
    })
  })
})

describe('getPosterOffer', () => {
  test('formats the validity for the poster', () => {
    const offer = getPosterOffer({
      ...createOfferContent('mercado'),
      validUntil: '2026-10-20'
    })

    expect(offer.validUntil).toBe('20/10/2026')
  })

  test('shows a placeholder while there is no validity', () => {
    const offer = getPosterOffer(createOfferContent('mercado'))

    expect(offer.validUntil).toBe(VALIDITY_PLACEHOLDER)
  })
})
