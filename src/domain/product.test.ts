import { describe, expect, test } from 'vitest'

import {
  getExtraCodeChanges,
  getProductChanges,
  isValidCode,
  normalizeExtraCodes,
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

describe('normalizeExtraCodes', () => {
  test('drops blanks, repeats and the main code', () => {
    expect(
      normalizeExtraCodes([' 2001', '', '2002', '20 01', '1234'], '1234')
    ).toEqual(['2001', '2002'])
  })
})

describe('getExtraCodeChanges', () => {
  test('lists the added and removed codes', () => {
    expect(getExtraCodeChanges(['2001', '2002'], ['2002', '2003'])).toEqual({
      added: ['2003'],
      removed: ['2001']
    })
  })
})
