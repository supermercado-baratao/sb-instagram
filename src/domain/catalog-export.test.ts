import { describe, expect, test } from 'vitest'

import type { Product } from '@/domain/product'

import {
  type CatalogExportContext,
  checkCatalogExport,
  formatCatalogExportReport,
  formatCatalogProduct,
  toCatalogDescriptionName
} from './catalog-export'

const EAN = '7891000100103'

const eanProduct: Product = {
  id: '0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d',
  codes: [EAN],
  name: 'Leite Condensado',
  brand: 'Moça',
  unit: '395 g',
  photo: `${EAN}.png`
}

const internalProduct: Product = {
  id: '1c7a4d2f-6e3b-4a9c-8d2e-3f4a5b6c7d8e',
  codes: ['2001'],
  name: 'Pão Francês',
  brand: null,
  unit: null,
  photo: '2001.png'
}

const emptyContext: CatalogExportContext = {
  catalogEans: new Set(),
  catalogNames: new Set(),
  exportedNames: new Set()
}

describe('toCatalogDescriptionName', () => {
  test.each([
    ['Pão Francês', 'pao-frances'],
    ['  Picanha Bovina  ', 'picanha-bovina'],
    ['AÇÚCAR Cristal 1kg', 'acucar-cristal-1kg'],
    ['Queijo (Mussarela) - Fatiado', 'queijo-mussarela-fatiado']
  ])('turns %s into %s', (name, fileName) => {
    expect(toCatalogDescriptionName(name)).toBe(fileName)
  })
})

describe('checkCatalogExport', () => {
  test('places a complete EAN product in ean/ under its code', () => {
    expect(checkCatalogExport(eanProduct, emptyContext)).toEqual({
      status: 'ok',
      target: { folder: 'ean', base: EAN }
    })
  })

  test('places an internal code product in no-ean/ under its name', () => {
    expect(checkCatalogExport(internalProduct, emptyContext)).toEqual({
      status: 'ok',
      target: { folder: 'no-ean', base: 'pao-frances' }
    })
  })

  test('skips a product without photo', () => {
    expect(
      checkCatalogExport({ ...eanProduct, photo: null }, emptyContext)
    ).toEqual({ status: 'skipped', reason: 'Sem foto' })
  })

  test.each([
    [{ brand: null }, 'Falta a marca'],
    [{ unit: ' ' }, 'Falta a unidade'],
    [{ brand: '', unit: null }, 'Faltam a marca e a unidade']
  ])('skips an EAN product with %o', (changes, reason) => {
    expect(
      checkCatalogExport({ ...eanProduct, ...changes }, emptyContext)
    ).toEqual({ status: 'skipped', reason })
  })

  test('skips an EAN already in the catalog', () => {
    expect(
      checkCatalogExport(eanProduct, {
        ...emptyContext,
        catalogEans: new Set([EAN])
      })
    ).toEqual({ status: 'skipped', reason: 'O EAN já está no catálogo' })
  })

  test('skips an internal code product whose name has no letter', () => {
    expect(
      checkCatalogExport({ ...internalProduct, name: '123' }, emptyContext)
    ).toMatchObject({ status: 'skipped' })
  })

  test('skips a name the catalog already has', () => {
    expect(
      checkCatalogExport(internalProduct, {
        ...emptyContext,
        catalogNames: new Set(['pao-frances'])
      })
    ).toEqual({
      status: 'skipped',
      reason: 'O catálogo já tem a imagem pao-frances.png'
    })
  })

  test('skips a name another product already took in the export', () => {
    expect(
      checkCatalogExport(internalProduct, {
        ...emptyContext,
        exportedNames: new Set(['pao-frances'])
      })
    ).toEqual({
      status: 'skipped',
      reason: 'Outro produto já foi exportado como pao-frances.png'
    })
  })
})

describe('formatCatalogProduct', () => {
  test('writes only the catalog fields, trimmed', () => {
    expect(
      JSON.parse(formatCatalogProduct({ ...eanProduct, name: ' Leite ' }))
    ).toEqual({ name: 'Leite', brand: 'Moça', unit: '395 g' })
  })
})

describe('formatCatalogExportReport', () => {
  test('lists each skipped product with its reason', () => {
    expect(
      formatCatalogExportReport([
        {
          codes: [EAN, '2001'],
          name: 'Leite Condensado',
          reason: 'Falta a marca'
        }
      ])
    ).toContain(`${EAN}, 2001 · Leite Condensado: Falta a marca`)
  })

  test('says when no product was left out', () => {
    expect(formatCatalogExportReport([])).toBe(
      'Todos os produtos entraram na exportação para o catálogo.\n'
    )
  })
})
