import { describe, expect, it } from 'vitest'

import {
  hasProductFormChanges,
  type ProductFormValues
} from './product-form-changes'

const initial: ProductFormValues = {
  description: 'Café Pilão',
  unit: '500 g',
  voiceText: '',
  codes: ['7896089012453', '123'],
  newPhoto: false
}

describe('hasProductFormChanges', () => {
  it('finds no change in the values the form opened with', () => {
    expect(hasProductFormChanges(initial, { ...initial })).toBe(false)
  })

  it('ignores spaces around the texts', () => {
    expect(
      hasProductFormChanges(initial, {
        ...initial,
        description: ' Café Pilão ',
        unit: '500 g '
      })
    ).toBe(false)
  })

  it('ignores the order and repeats of the codes', () => {
    expect(
      hasProductFormChanges(initial, {
        ...initial,
        codes: ['123', '7896089012453', '123']
      })
    ).toBe(false)
  })

  it.each([
    ['description', { description: 'Café Melitta' }],
    ['unit', { unit: '250 g' }],
    ['voice text', { voiceText: 'café pilão' }],
    ['codes', { codes: ['7896089012453'] }],
    ['photo', { newPhoto: true }]
  ])('finds a change in the %s', (_, change) => {
    expect(hasProductFormChanges(initial, { ...initial, ...change })).toBe(true)
  })
})
