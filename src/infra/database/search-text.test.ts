import { describe, expect, test } from 'vitest'

import { normalizeSearchText } from './search-text'

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
