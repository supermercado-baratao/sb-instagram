import { describe, expect, test } from 'vitest'

import type { Product } from '@/domain/product'

import {
  type CatalogExportContext,
  checkCatalogExport,
  formatCatalogExportReport,
  formatCatalogProduct,
  needsCatalogExport,
  toCatalogDescriptionName
} from './catalog-export'

const EAN = '7891000100103'
const OTHER_EAN = '7891000100110'

const eanProduct: Product = {
  id: '0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d',
  codes: [EAN],
  description: 'Leite Condensado Moça',
  unit: '395 g',
  voiceText: null,
  photo: `${EAN}.png`
}

const internalProduct: Product = {
  id: '1c7a4d2f-6e3b-4a9c-8d2e-3f4a5b6c7d8e',
  codes: ['2001'],
  description: 'Pão Francês',
  unit: null,
  voiceText: null,
  photo: '2001.png'
}

const emptyContext: CatalogExportContext = {
  catalogEans: new Set(),
  exportedEans: new Set(),
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
      target: { folder: 'ean', base: EAN, codes: [] }
    })
  })

  test('places a group in ean/ under its first EAN, with the others as codes', () => {
    expect(
      checkCatalogExport(
        { ...eanProduct, codes: ['2001', EAN, OTHER_EAN] },
        emptyContext
      )
    ).toEqual({
      status: 'ok',
      target: { folder: 'ean', base: EAN, codes: [OTHER_EAN] }
    })
  })

  test('places a group of internal codes in no-ean/ under its description', () => {
    expect(
      checkCatalogExport(
        { ...internalProduct, codes: ['2001', '2002'] },
        emptyContext
      )
    ).toEqual({
      status: 'ok',
      target: { folder: 'no-ean', base: 'pao-frances', codes: [] }
    })
  })

  test('places an internal code product in no-ean/ under its description', () => {
    expect(checkCatalogExport(internalProduct, emptyContext)).toEqual({
      status: 'ok',
      target: { folder: 'no-ean', base: 'pao-frances', codes: [] }
    })
  })

  test('skips a product without photo', () => {
    expect(
      checkCatalogExport({ ...eanProduct, photo: null }, emptyContext)
    ).toEqual({ status: 'skipped', kind: 'pending', reason: 'Sem foto' })
  })

  test.each([
    [{ unit: ' ' }, 'Falta a unidade'],
    [{ unit: null }, 'Falta a unidade']
  ])('skips an EAN product with %o', (changes, reason) => {
    expect(
      checkCatalogExport({ ...eanProduct, ...changes }, emptyContext)
    ).toEqual({ status: 'skipped', kind: 'pending', reason })
  })

  test('skips a product with an EAN already in the catalog as in the catalog', () => {
    expect(
      checkCatalogExport(
        { ...eanProduct, codes: [EAN, OTHER_EAN], photo: null, unit: null },
        { ...emptyContext, catalogEans: new Set([OTHER_EAN]) }
      )
    ).toEqual({
      status: 'skipped',
      kind: 'in-catalog',
      reason: `O EAN ${OTHER_EAN} já está no catálogo`
    })
  })

  test('skips a product with an EAN another product took in the export', () => {
    expect(
      checkCatalogExport(
        { ...eanProduct, codes: [EAN, OTHER_EAN] },
        { ...emptyContext, exportedEans: new Set([EAN]) }
      )
    ).toEqual({
      status: 'skipped',
      kind: 'pending',
      reason: `O EAN ${EAN} já foi exportado em outro produto`
    })
  })

  test('skips an internal code product whose description has no letter', () => {
    expect(
      checkCatalogExport(
        { ...internalProduct, description: '123' },
        emptyContext
      )
    ).toMatchObject({ status: 'skipped', kind: 'pending' })
  })

  test('skips a description the catalog already has as in the catalog', () => {
    expect(
      checkCatalogExport(
        { ...internalProduct, photo: null },
        {
          ...emptyContext,
          catalogNames: new Set(['pao-frances'])
        }
      )
    ).toEqual({
      status: 'skipped',
      kind: 'in-catalog',
      reason: 'O catálogo já tem a imagem pao-frances.png'
    })
  })

  test('skips a description another product already took in the export', () => {
    expect(
      checkCatalogExport(internalProduct, {
        ...emptyContext,
        exportedNames: new Set(['pao-frances'])
      })
    ).toEqual({
      status: 'skipped',
      kind: 'pending',
      reason: 'Outro produto já foi exportado como pao-frances.png'
    })
  })
})

describe('formatCatalogProduct', () => {
  test('writes only the catalog fields, trimmed', () => {
    expect(
      JSON.parse(
        formatCatalogProduct({ ...eanProduct, description: ' Leite ' }, [])
      )
    ).toEqual({ description: 'Leite', unit: '395 g' })
  })

  test('keeps the codes on one line while they fit, like Prettier', () => {
    expect(formatCatalogProduct(eanProduct, [OTHER_EAN])).toBe(
      `{\n  "description": "Leite Condensado Moça",\n  "unit": "395 g",\n  "codes": ["${OTHER_EAN}"]\n}\n`
    )
  })

  test('breaks the codes into lines past the print width, like Prettier', () => {
    const codes = Array.from({ length: 5 }, () => OTHER_EAN)
    expect(formatCatalogProduct(eanProduct, codes)).toContain(
      `  "codes": [\n${codes.map((code) => `    "${code}"`).join(',\n')}\n  ]\n}\n`
    )
  })
})

describe('formatCatalogExportReport', () => {
  test('lists the pending products apart from those in the catalog', () => {
    expect(
      formatCatalogExportReport([
        {
          codes: [OTHER_EAN],
          description: 'Café',
          kind: 'in-catalog',
          reason: `O EAN ${OTHER_EAN} já está no catálogo`
        },
        {
          codes: [EAN, '2001'],
          description: 'Leite Condensado',
          kind: 'pending',
          reason: 'Falta a unidade'
        }
      ])
    ).toBe(
      [
        'Produtos com pendências, que ficaram fora da exportação:',
        '',
        `${EAN}, 2001 · Leite Condensado: Falta a unidade`,
        '',
        'Produtos que já estão no catálogo:',
        '',
        `${OTHER_EAN} · Café: O EAN ${OTHER_EAN} já está no catálogo`,
        ''
      ].join('\n')
    )
  })

  test('leaves out a section without products', () => {
    expect(
      formatCatalogExportReport([
        {
          codes: ['2001'],
          description: 'Pão Francês',
          kind: 'in-catalog',
          reason: 'O catálogo já tem a imagem pao-frances.png'
        }
      ])
    ).not.toContain('pendências')
  })

  test('says when no product was left out', () => {
    expect(formatCatalogExportReport([])).toBe(
      'Todos os produtos entraram na exportação para o catálogo.\n'
    )
  })
})

describe('needsCatalogExport', () => {
  test.each([
    { kind: 'pending', reason: 'Falta a unidade' },
    { kind: 'ready' }
  ] as const)('keeps a $kind product', (status) => {
    expect(needsCatalogExport(status)).toBe(true)
  })

  test.each([
    { kind: 'in-catalog', reason: 'O EAN já está no catálogo' },
    { kind: 'exported', exportedAt: new Date() }
  ] as const)('leaves out an $kind product', (status) => {
    expect(needsCatalogExport(status)).toBe(false)
  })
})
