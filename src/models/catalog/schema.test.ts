import { describe, expect, test } from 'vitest'

import { checkCatalogProduct } from './schema'

const ean = '7891000100103'

describe('checkCatalogProduct', () => {
  const product = { description: 'Leite Integral Marca', unit: '1 L' }

  test('accepts a product with description and unit', () => {
    expect(checkCatalogProduct(product, ean)).toEqual([])
  })

  test.each([null, [], 'Leite', 1])(
    'rejects %j, which is not an object',
    (data) => {
      expect(checkCatalogProduct(data, ean)).toHaveLength(1)
    }
  )

  test('reports each missing or empty field', () => {
    expect(checkCatalogProduct({ description: ' ' }, ean)).toEqual([
      'O campo description precisa ser um texto não vazio',
      'O campo unit precisa ser um texto não vazio'
    ])
  })

  test('reports keys outside the schema', () => {
    expect(checkCatalogProduct({ ...product, price: 10 }, ean)).toEqual([
      'O campo price não faz parte do esquema'
    ])
  })

  test('accepts the other EANs of the product in codes', () => {
    expect(
      checkCatalogProduct(
        { ...product, codes: ['7891000100110', '12345670'] },
        ean
      )
    ).toEqual([])
  })

  test.each([[], '7891000100110', [7_891_000_100_110]])(
    'rejects codes %j, which is not a list of EAN texts',
    (codes) => {
      expect(checkCatalogProduct({ ...product, codes }, ean)).toHaveLength(1)
    }
  )

  test('reports invalid, repeated and own EANs in codes', () => {
    expect(
      checkCatalogProduct(
        {
          ...product,
          codes: ['7891000100111', ean, '7891000100110', '7891000100110']
        },
        ean
      )
    ).toEqual([
      'O código "7891000100111" em codes não é um EAN válido',
      `O EAN ${ean} em codes já é o nome do arquivo`,
      'O EAN 7891000100110 se repete em codes'
    ])
  })
})
