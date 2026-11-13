import { describe, expect, test } from 'vitest'

import { codeSchema, isProductId, productFormSchema } from './schema'

describe('isProductId', () => {
  test('accepts a UUID and nothing else', () => {
    expect(isProductId('0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d')).toBe(true)
    expect(isProductId('7891000100103')).toBe(false)
    expect(isProductId('../0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d')).toBe(false)
  })
})

describe('codeSchema', () => {
  test('strips the spaces a scanner or a paste brings', () => {
    expect(codeSchema.parse(' 7891000100103\n')).toBe('7891000100103')
  })

  test.each([
    ['  ', 'Informe o código.'],
    ['a/b', 'O código só pode ter letras sem acento']
  ])('rejects %j', (code, message) => {
    expect(() => codeSchema.parse(code)).toThrow(message)
  })
})

describe('productFormSchema', () => {
  const form = {
    codes: ['2001'],
    description: ' Picanha ',
    photo: null,
    id: '',
    unit: ' ',
    voiceText: null,
    catalogImage: null,
    catalogEan: null,
    replace: null
  }

  test('trims the texts and turns blanks into null', () => {
    expect(productFormSchema.parse(form)).toMatchObject({
      codes: ['2001'],
      description: 'Picanha',
      unit: null,
      voiceText: null,
      catalogImage: '',
      replace: undefined
    })
  })

  test('reports the codes before the description', () => {
    const result = productFormSchema.safeParse({
      ...form,
      codes: [' '],
      description: ''
    })

    expect(result.error?.issues[0]?.message).toBe(
      'Informe pelo menos um código.'
    )
  })

  test('refuses an id that is not a product', () => {
    const result = productFormSchema.safeParse({ ...form, id: '../logo' })

    expect(result.error?.issues[0]?.message).toBe(
      'Este produto não existe mais.'
    )
  })
})
