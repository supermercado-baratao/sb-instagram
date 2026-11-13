import { describe, expect, test } from 'vitest'

import { fitFontSize } from './fit-font-size'

const options = {
  width: 200,
  lines: 1,
  maxFontSize: 40,
  minFontSize: 10,
  charWidth: 0.5
}

describe('fitFontSize', () => {
  test('keeps the largest size when the text fits', () => {
    expect(fitFontSize({ ...options, text: 'Arroz' })).toBe(40)
  })

  test('shrinks the size until the text fits the available width', () => {
    expect(fitFontSize({ ...options, text: 'A'.repeat(20) })).toBe(20)
  })

  test('spreads the text over the available lines', () => {
    expect(fitFontSize({ ...options, text: 'A'.repeat(20), lines: 2 })).toBe(40)
  })

  test('never goes below the smallest size', () => {
    expect(fitFontSize({ ...options, text: 'A'.repeat(200) })).toBe(10)
  })

  test('ignores surrounding whitespace', () => {
    expect(fitFontSize({ ...options, text: `  ${'A'.repeat(20)}  ` })).toBe(20)
  })

  test('uses the largest size for empty text', () => {
    expect(fitFontSize({ ...options, text: '' })).toBe(40)
  })
})
