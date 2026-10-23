import { describe, expect, test } from 'vitest'

import { isValidCode, normalizeSearchText } from './product'

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
