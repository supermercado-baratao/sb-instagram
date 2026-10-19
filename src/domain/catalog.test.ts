import { describe, expect, test } from 'vitest'

import {
  type CatalogImage,
  checkCatalogImage,
  checkCatalogProduct,
  checkEanFileNames,
  checkNoEanFileNames,
  getCatalogImageLayout
} from './catalog'

const ean = '7891000100103'

describe('checkEanFileNames', () => {
  test('accepts an image and a data file named after the same EAN', () => {
    expect(checkEanFileNames([`${ean}.json`, `${ean}.png`])).toEqual([])
  })

  test('ignores the placeholder that keeps the folder in git', () => {
    expect(checkEanFileNames(['.gitkeep'])).toEqual([])
  })

  test('reports the missing data file of an image', () => {
    expect(checkEanFileNames([`${ean}.png`])).toEqual([
      { file: `${ean}.png`, message: `Falta o arquivo ${ean}.json` }
    ])
  })

  test('reports the missing image of a data file', () => {
    expect(checkEanFileNames([`${ean}.json`])).toEqual([
      { file: `${ean}.json`, message: `Falta o arquivo ${ean}.png` }
    ])
  })

  test('reports a name that is not a valid EAN', () => {
    expect(
      checkEanFileNames(['7891000100104.json', '7891000100104.png'])
    ).toEqual([
      expect.objectContaining({ file: '7891000100104.json' }),
      expect.objectContaining({ file: '7891000100104.png' })
    ])
  })

  test('reports an unsupported extension', () => {
    expect(
      checkEanFileNames([`${ean}.json`, `${ean}.png`, `${ean}.jpg`])
    ).toEqual([expect.objectContaining({ file: `${ean}.jpg` })])
  })
})

describe('checkNoEanFileNames', () => {
  test.each(['picanha-bovina.png', 'pao-frances.png', 'ovos-12-unidades.png'])(
    'accepts %s',
    (fileName) => {
      expect(checkNoEanFileNames([fileName])).toEqual([])
    }
  )

  test('ignores the placeholder that keeps the folder in git', () => {
    expect(checkNoEanFileNames(['.gitkeep'])).toEqual([])
  })

  test.each([
    'Picanha-Bovina.png',
    'pão-francês.png',
    'picanha bovina.png',
    'picanha_bovina.png',
    'picanha--bovina.png',
    '-picanha.png',
    '1234.png'
  ])('reports the name %s', (fileName) => {
    expect(checkNoEanFileNames([fileName])).toEqual([
      expect.objectContaining({ file: fileName })
    ])
  })

  test.each(['picanha-bovina.webp', 'picanha-bovina.json', 'picanha-bovina'])(
    'reports the extension of %s',
    (fileName) => {
      expect(checkNoEanFileNames([fileName])).toEqual([
        expect.objectContaining({ file: fileName })
      ])
    }
  )
})

describe('checkCatalogProduct', () => {
  const product = { name: 'Leite Integral', brand: 'Marca', unit: '1 L' }

  test('accepts a product with name, brand and unit', () => {
    expect(checkCatalogProduct(product)).toEqual([])
  })

  test.each([null, [], 'Leite', 1])(
    'rejects %j, which is not an object',
    (data) => {
      expect(checkCatalogProduct(data)).toHaveLength(1)
    }
  )

  test('reports each missing or empty field', () => {
    expect(checkCatalogProduct({ name: ' ', brand: 1 })).toEqual([
      'O campo name precisa ser um texto não vazio',
      'O campo brand precisa ser um texto não vazio',
      'O campo unit precisa ser um texto não vazio'
    ])
  })

  test('reports keys outside the schema', () => {
    expect(checkCatalogProduct({ ...product, price: 10 })).toEqual([
      'O campo price não faz parte do esquema'
    ])
  })
})

describe('checkCatalogImage', () => {
  const image: CatalogImage = {
    format: 'png',
    width: 800,
    height: 800,
    bytes: 100 * 1024,
    cornerAlphas: [0, 0, 0, 0]
  }

  test('accepts a square, transparent PNG within the limits', () => {
    expect(checkCatalogImage(image)).toEqual([])
  })

  test.each([600, 800])('accepts a side of %i px', (side) => {
    expect(checkCatalogImage({ ...image, width: side, height: side })).toEqual(
      []
    )
  })

  test('accepts exactly the maximum file size', () => {
    expect(checkCatalogImage({ ...image, bytes: 1024 * 1024 })).toEqual([])
  })

  test.each([
    ['a format other than PNG', { format: 'webp' }],
    ['a missing format', { format: undefined }],
    ['a non-square image', { width: 800, height: 700 }],
    ['a side below the minimum', { width: 599, height: 599 }],
    ['a side above the maximum', { width: 1001, height: 1001 }],
    ['a file above the maximum size', { bytes: 1024 * 1024 + 1 }],
    ['an opaque corner', { cornerAlphas: [0, 0, 255, 0] }],
    ['a translucent corner', { cornerAlphas: [0, 1, 0, 0] }]
  ])('reports %s', (_, change) => {
    expect(checkCatalogImage({ ...image, ...change })).toHaveLength(1)
  })
})

describe('getCatalogImageLayout', () => {
  test('shrinks a large image to the maximum side, centered with a margin', () => {
    expect(getCatalogImageLayout({ width: 4000, height: 2000 })).toEqual({
      side: 800,
      width: 720,
      height: 360,
      left: 40,
      top: 220
    })
  })

  test('keeps the size of a small image and only adds the margin', () => {
    expect(getCatalogImageLayout({ width: 400, height: 630 })).toEqual({
      side: 700,
      width: 400,
      height: 630,
      left: 150,
      top: 35
    })
  })

  test('caps the side at the maximum when the margin would exceed it', () => {
    expect(getCatalogImageLayout({ width: 750, height: 750 })).toEqual({
      side: 800,
      width: 720,
      height: 720,
      left: 40,
      top: 40
    })
  })
})
