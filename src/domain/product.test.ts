import { describe, expect, test } from 'vitest'

import {
  getPhotoFileName,
  getProductChanges,
  isSameCodeSet,
  isValidCode,
  isValidProductId,
  normalizeCodes,
  normalizeSearchText
} from './product'

describe('isValidCode', () => {
  test.each(['7891000100103', '2001', 'PIC-01', 'cod_7.5'])(
    'accepts %s',
    (code) => {
      expect(isValidCode(code)).toBe(true)
    }
  )

  test.each(['', '../1234', 'a/b', String.raw`a\b`, 'pão'])(
    'rejects %s',
    (code) => {
      expect(isValidCode(code)).toBe(false)
    }
  )
})

describe('normalizeSearchText', () => {
  test.each([
    ['Pão', 'pao'],
    ['AÇÚCAR', 'acucar'],
    ['Maçã Fuji', 'maca fuji'],
    ['Feijão 1 kg', 'feijao 1 kg']
  ])('turns %s into %s', (text, normalized) => {
    expect(normalizeSearchText(text)).toBe(normalized)
  })
})

describe('getProductChanges', () => {
  const current = { name: 'Arroz agulhinha', brand: 'Camil', unit: '5 kg' }

  test('finds no change in the same details', () => {
    expect(getProductChanges(current, { ...current })).toEqual([])
  })

  test('lists each changed field with its old and new value', () => {
    expect(
      getProductChanges(current, {
        name: 'Arroz agulhinha tipo 1',
        brand: null,
        unit: '5 kg'
      })
    ).toEqual([
      {
        field: 'name',
        from: 'Arroz agulhinha',
        to: 'Arroz agulhinha tipo 1'
      },
      { field: 'brand', from: 'Camil', to: null }
    ])
  })
})

describe('normalizeCodes', () => {
  test('drops blanks and repeats and sorts the codes', () => {
    expect(normalizeCodes([' 2002', '', '2001', '20 01'])).toEqual([
      '2001',
      '2002'
    ])
  })
})

describe('isSameCodeSet', () => {
  test('compares the codes in any order', () => {
    expect(isSameCodeSet(['2002', '2001'], ['2001', ' 2002'])).toBe(true)
  })

  test('tells a product from a group that also has its code', () => {
    expect(isSameCodeSet(['2001'], ['2001', '2002'])).toBe(false)
    expect(isSameCodeSet(['2001', '2002'], ['2001', '2003'])).toBe(false)
  })
})

describe('isValidProductId', () => {
  test('accepts a UUID and nothing else', () => {
    expect(isValidProductId('0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d')).toBe(true)
    expect(isValidProductId('7891000100103')).toBe(false)
    expect(isValidProductId('../0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d')).toBe(
      false
    )
  })
})

describe('getPhotoFileName', () => {
  const id = '0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d'

  test('names the photo of a single code product after its code', () => {
    expect(getPhotoFileName({ id, codes: ['2001'] })).toBe('2001.png')
  })

  test('names the photo of a group after its id', () => {
    expect(getPhotoFileName({ id, codes: ['2001', '2002'] })).toBe(`${id}.png`)
  })
})
