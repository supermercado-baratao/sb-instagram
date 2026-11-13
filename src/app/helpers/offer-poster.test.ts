import { describe, expect, test } from 'vitest'

import { createOfferContent } from '@/models/offer/offer'
import type { Product } from '@/models/product/product'

import {
  getPosterOffer,
  getPosterProducts,
  VALIDITY_PLACEHOLDER
} from './offer-poster'

const product: Product = {
  id: '0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d',
  codes: ['7891000100103'],
  description: 'Leite integral Italac',
  unit: '1L',
  voiceText: null,
  photo: '7891000100103.png'
}

describe('getPosterProducts', () => {
  test('points the image to the store photo route', () => {
    const [poster] = getPosterProducts([{ product, priceInCents: 549 }])

    expect(poster).toMatchObject({
      description: 'Leite integral Italac',
      unit: '1L',
      image: '/fotos/0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d',
      priceInCents: 549
    })
  })

  test('leaves the image empty for a product without photo', () => {
    const [poster] = getPosterProducts([
      { product: { ...product, photo: null }, priceInCents: 549 }
    ])

    expect(poster.image).toBe(null)
  })

  test('turns an empty slot into a blank product', () => {
    expect(getPosterProducts([null])[0]).toMatchObject({
      description: '',
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
