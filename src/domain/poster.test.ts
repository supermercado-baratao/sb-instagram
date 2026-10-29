import { describe, expect, test } from 'vitest'

import {
  getPageTemplate,
  getPosterFitScale,
  getPosterLayout,
  getVisibleProducts,
  isHiddenField,
  isPosterLayout,
  type OfferProduct,
  PAGE_PRODUCT_COUNT,
  POSTER_SIZE,
  type PosterLayout,
  type PosterTemplate,
  resolvePosterField,
  splitPrice
} from './poster'

const products: OfferProduct[] = Array.from(
  { length: PAGE_PRODUCT_COUNT },
  (_, index) => ({
    code: String(index),
    codeType: 'internal',
    name: `Produto ${index}`,
    brand: '',
    unit: 'UN',
    image: null,
    priceInCents: 100
  })
)

const templates: PosterTemplate[] = [
  { id: 'a', name: 'Mercado', colors: { primary: '#000', accent: '#f00' } },
  { id: 'b', name: 'Açougue', colors: { primary: '#300', accent: '#f00' } }
]

describe('getVisibleProducts', () => {
  test.each<PosterLayout>([9, 6, 4, 3])(
    'shows the first %i products',
    (layout) => {
      const visible = getVisibleProducts({ layout, products })
      expect(visible).toEqual(products.slice(0, layout))
    }
  )
})

describe('getPosterLayout', () => {
  test('lays out 3 products as one horizontal card per row', () => {
    expect(getPosterLayout(3)).toMatchObject({
      columns: 1,
      rows: 3,
      orientation: 'horizontal'
    })
  })

  test('has room for every visible product in each layout', () => {
    for (const layout of [9, 6, 4, 3] as const) {
      const { columns, rows } = getPosterLayout(layout)
      expect(columns * rows).toBe(layout)
    }
  })
})

describe('isPosterLayout', () => {
  test('accepts only the supported product counts', () => {
    expect(isPosterLayout(6)).toBe(true)
    expect(isPosterLayout(5)).toBe(false)
    expect(isPosterLayout('9')).toBe(false)
  })
})

describe('getPageTemplate', () => {
  test('returns the template the page points to', () => {
    expect(getPageTemplate(templates, 'b')?.name).toBe('Açougue')
  })

  test('falls back to the first template when the page points to a missing one', () => {
    expect(getPageTemplate(templates, 'deleted')?.id).toBe('a')
  })

  test('returns undefined when the instance has no templates', () => {
    expect(getPageTemplate([], 'a')).toBeUndefined()
  })
})

describe('isHiddenField', () => {
  test('hides a field that holds only the marker', () => {
    expect(isHiddenField('-')).toBe(true)
    expect(isHiddenField('  - ')).toBe(true)
  })

  test('keeps empty and regular values visible', () => {
    expect(isHiddenField('')).toBe(false)
    expect(isHiddenField('Coca-Cola')).toBe(false)
  })
})

describe('resolvePosterField', () => {
  test('shows the value without surrounding whitespace', () => {
    expect(resolvePosterField(' Coca-Cola ', 'MARCA')).toBe('Coca-Cola')
  })

  test('shows the placeholder for an empty value', () => {
    expect(resolvePosterField('  ', 'MARCA')).toBe('MARCA')
  })

  test('drops a hidden field', () => {
    expect(resolvePosterField('-', 'MARCA')).toBeNull()
  })
})

describe('splitPrice', () => {
  test('splits reais and cents', () => {
    expect(splitPrice(2398)).toEqual({ integer: '23', decimal: '98' })
  })

  test('pads cents below ten', () => {
    expect(splitPrice(105)).toEqual({ integer: '1', decimal: '05' })
  })

  test('shows zero reais for prices under one real', () => {
    expect(splitPrice(99)).toEqual({ integer: '0', decimal: '99' })
  })
})

describe('getPosterFitScale', () => {
  test('fits the poster to the narrower side', () => {
    expect(getPosterFitScale({ width: 540, height: 1350 })).toBe(0.5)
    expect(getPosterFitScale({ width: 1080, height: 675 })).toBe(0.5)
  })

  test('never enlarges the poster', () => {
    expect(getPosterFitScale({ width: 4000, height: 4000 })).toBe(1)
    expect(getPosterFitScale(POSTER_SIZE)).toBe(1)
  })

  test('returns 0 for an area not measured yet', () => {
    expect(getPosterFitScale({ width: 0, height: 0 })).toBe(0)
  })
})
