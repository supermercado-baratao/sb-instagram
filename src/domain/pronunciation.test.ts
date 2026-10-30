import { describe, expect, test } from 'vitest'

import {
  applyPronunciations,
  getPronunciationsError,
  isPronunciationList,
  normalizePronunciations
} from '@/domain/pronunciation'

describe('applyPronunciations', () => {
  const dictionary = [
    { term: 'Veludo', spoken: 'Velude' },
    { term: 'cream', spoken: 'crim' },
    { term: 'Cream Cracker', spoken: 'kreme cráquer' },
    { term: 'Bom', spoken: 'Bonzão' },
    { term: 'M&M', spoken: 'emendéms' }
  ]

  test('replaces whole terms, ignoring case', () => {
    expect(applyPronunciations('Papel VELUDO', dictionary)).toBe('Papel Velude')
  })

  test('prefers the longest term and matches any spacing inside it', () => {
    expect(applyPronunciations('Biscoito cream  cracker', dictionary)).toBe(
      'Biscoito kreme cráquer'
    )
    expect(applyPronunciations('Sorvete cream', dictionary)).toBe(
      'Sorvete crim'
    )
  })

  test('never changes part of a word', () => {
    expect(applyPronunciations('Bombril', dictionary)).toBe('Bombril')
  })

  test('takes terms with symbols literally', () => {
    expect(applyPronunciations('Chocolate M&M 80g', dictionary)).toBe(
      'Chocolate emendéms 80g'
    )
  })

  test('leaves the text alone with an empty dictionary', () => {
    expect(applyPronunciations('Arroz', [])).toBe('Arroz')
  })
})

describe('getPronunciationsError', () => {
  test('accepts a valid dictionary', () => {
    expect(
      getPronunciationsError([{ term: 'Veludo', spoken: 'Velude' }])
    ).toBeUndefined()
  })

  test('points to an empty field', () => {
    expect(
      getPronunciationsError([
        { term: 'Veludo', spoken: 'Velude' },
        { term: ' ', spoken: 'x' }
      ])
    ).toMatchObject({ index: 1, field: 'term' })
    expect(
      getPronunciationsError([{ term: 'Veludo', spoken: '' }])
    ).toMatchObject({ index: 0, field: 'spoken' })
  })

  test('refuses a term repeated in another case', () => {
    expect(
      getPronunciationsError([
        { term: 'Veludo', spoken: 'Velude' },
        { term: 'veludo ', spoken: 'Veludo' }
      ])
    ).toMatchObject({ index: 1, field: 'term' })
  })
})

test('normalizePronunciations trims and collapses the spaces of a term', () => {
  expect(
    normalizePronunciations([{ term: ' cream   cracker ', spoken: ' crim ' }])
  ).toEqual([{ term: 'cream cracker', spoken: 'crim' }])
})

test('isPronunciationList checks the shape a Server Action receives', () => {
  expect(isPronunciationList([{ term: 'a', spoken: 'b' }])).toBe(true)
  expect(isPronunciationList([{ term: 'a' }])).toBe(false)
  expect(isPronunciationList('a')).toBe(false)
})
