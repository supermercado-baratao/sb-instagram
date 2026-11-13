import { describe, expect, test } from 'vitest'

import {
  spellNumber,
  spellNumbers,
  spellPrice,
  suggestVoiceText
} from '@/models/radio-ad/spoken-text'

describe('spellNumber', () => {
  test.each([
    [0, 'zero'],
    [1, 'um'],
    [14, 'quatorze'],
    [21, 'vinte e um'],
    [100, 'cem'],
    [101, 'cento e um'],
    [175, 'cento e setenta e cinco'],
    [900, 'novecentos'],
    [1000, 'mil'],
    [1020, 'mil e vinte'],
    [1500, 'mil e quinhentos'],
    [1230, 'mil duzentos e trinta'],
    [2001, 'dois mil e um'],
    [21_345, 'vinte e um mil trezentos e quarenta e cinco'],
    [1_000_000, 'um milhão'],
    [2_000_100, 'dois milhões e cem']
  ])('spells %i', (number, text) => {
    expect(spellNumber(number)).toBe(text)
  })

  test('agrees with a feminine noun', () => {
    expect(spellNumber(2, 'feminine')).toBe('duas')
    expect(spellNumber(221, 'feminine')).toBe('duzentas e vinte e uma')
  })

  test('refuses what is not a whole number', () => {
    expect(() => spellNumber(1.5)).toThrow(RangeError)
    expect(() => spellNumber(-1)).toThrow(RangeError)
  })
})

describe('spellPrice', () => {
  test.each([
    [1075, 'dez e setenta e cinco'],
    [150, 'um e cinquenta'],
    [1000, 'dez reais'],
    [100, 'um real'],
    [99, 'noventa e nove centavos'],
    [1, 'um centavo'],
    [1005, 'dez reais e cinco centavos'],
    [101, 'um real e um centavo']
  ])('spells %i cents', (cents, text) => {
    expect(spellPrice(cents)).toBe(text)
  })
})

describe('spellNumbers', () => {
  test.each([
    ['900 ml', 'novecentos mililitros'],
    ['900ML', 'novecentos mililitros'],
    ['1 kg', 'um quilo'],
    ['5kg', 'cinco quilos'],
    ['1 L', 'um litro'],
    ['1,5 L', 'um litro e meio'],
    ['2,5kg', 'dois quilos e meio'],
    ['0,5 kg', 'meio quilo'],
    ['1,25 l', 'um vírgula vinte e cinco litros'],
    ['1,0 kg', 'um quilo'],
    ['1.000 g', 'mil gramas'],
    ['2 un', 'duas unidades'],
    ['1 unid', 'uma unidade']
  ])('spells the measure %s', (text, spoken) => {
    expect(spellNumbers(text)).toBe(spoken)
  })

  test('spells the numbers in a text, leaving the words around them', () => {
    expect(spellNumbers('Café 3 corações 500g')).toBe(
      'Café três corações quinhentos gramas'
    )
    expect(spellNumbers('Leve 12 pague 10')).toBe('Leve doze pague dez')
  })

  test('only takes a unit standing as a word of its own', () => {
    expect(spellNumbers('3 em 1')).toBe('três em um')
    expect(spellNumbers('2 mais')).toBe('dois mais')
  })
})

describe('suggestVoiceText', () => {
  test('leaves out a description with no letters or digits', () => {
    expect(suggestVoiceText({ description: '-', unit: 'Kg' }, [])).toBe('kg')
  })

  test('joins description and unit, with numbers spelled out', () => {
    expect(
      suggestVoiceText({ description: 'Arroz Tio João', unit: '5 kg' }, [])
    ).toBe('arroz tio joão, cinco quilos')
  })

  test('applies the dictionary after spelling, so it can change a unit', () => {
    expect(
      suggestVoiceText(
        { description: 'Biscoito Cream Cracker Vitarella', unit: '900ml' },
        [
          { term: 'cream cracker', spoken: 'kreme cráquer' },
          { term: 'mililitros', spoken: 'eme éli' }
        ]
      )
    ).toBe('biscoito kreme cráquer vitarella, novecentos eme éli')
  })

  test('writes the description in lowercase, keeping the dictionary’s own case', () => {
    expect(
      suggestVoiceText({ description: 'LEITE EM PÓ UHT ÇÃO', unit: '1 L' }, [
        { term: 'uht', spoken: 'U agá tê' }
      ])
    ).toBe('leite em pó U agá tê ção, um litro')
  })

  test('separates the unit with a comma that is never read as a decimal separator', () => {
    expect(
      suggestVoiceText(
        { description: 'Refrigerante Cola 2', unit: '1,5 L' },
        []
      )
    ).toBe('refrigerante cola dois, um litro e meio')
    expect(suggestVoiceText({ description: 'Arroz', unit: ' ' }, [])).toBe(
      'arroz'
    )
  })
})
