import { describe, expect, test } from 'vitest'

import { createOfferContent, type OfferContent } from '@/domain/offer'
import type { Product } from '@/domain/product'

import {
  appendGenerationPages,
  type GenerationPage,
  getGenerationPages,
  getGenerationPagesFromExport,
  resolveGenerationProduct,
  selectGenerationPages
} from './generation-pages'

const createProduct = (id: string, code: string): Product => ({
  id,
  codes: [code],
  description: `Produto ${code}`,
  unit: null,
  voiceText: null,
  photo: null
})

const picanha = createProduct('6f1f8c1e-4a7b-4d8e-9a3a-1b2c3d4e5f60', '1001')
const alcatra = createProduct('7a2b3c4d-5e6f-4a1b-8c9d-0e1f2a3b4c5d', '1002')

const products = [picanha, alcatra]

const findProduct = ({ productId }: { productId: string | null }) =>
  products.find((product) => product.id === productId)

const page = (items: GenerationPage['items']): GenerationPage => ({
  templateId: 'acougue',
  layout: 4,
  items
})

const item = (
  product: Product,
  position: number,
  priceInCents: number
): GenerationPage['items'][number] => ({
  position,
  productId: product.id,
  codes: product.codes,
  priceInCents
})

const byCodes = (codes: string[]) =>
  products.find((product) => product.codes.join(',') === codes.join(','))

const offer = (): OfferContent => {
  const content = createOfferContent('mercado')
  content.validUntil = '2026-11-19'
  content.pages[0].slots[0] = { product: alcatra, priceInCents: 4290 }
  return content
}

describe('getGenerationPages', () => {
  test('keeps only the slots the layout shows, with their positions', () => {
    const content = createOfferContent('mercado')
    content.pages[0] = {
      ...content.pages[0],
      layout: 3,
      slots: content.pages[0].slots
        .with(1, { product: picanha, priceInCents: 3990 })
        .with(5, { product: alcatra, priceInCents: 4590 })
    }

    expect(getGenerationPages(content)).toEqual([
      {
        templateId: 'mercado',
        layout: 3,
        items: [item(picanha, 1, 3990)]
      }
    ])
  })
})

describe('getGenerationPagesFromExport', () => {
  test('rebuilds each page in order, in the smallest layout that fits', () => {
    expect(
      getGenerationPagesFromExport({
        version: 1,
        name: 'Semana',
        pages: [
          {
            number: 1,
            products: Array.from({ length: 5 }, (_, index) => ({
              name: 'Picanha',
              codes: [`10${index}`],
              price: '39,90'
            }))
          },
          { number: 2, products: [] }
        ]
      })
    ).toEqual([
      {
        templateId: null,
        layout: 6,
        items: Array.from({ length: 5 }, (_, index) => ({
          position: index,
          productId: null,
          codes: [`10${index}`],
          priceInCents: 3990
        }))
      },
      { templateId: null, layout: 3, items: [] }
    ])
  })

  test('rebuilds a page of more than 9 products in the 12-product layout', () => {
    const pages = getGenerationPagesFromExport({
      version: 1,
      name: 'Semana',
      pages: [
        {
          number: 1,
          products: Array.from({ length: 10 }, (_, index) => ({
            name: 'Picanha',
            codes: [`10${index}`],
            price: '39,90'
          }))
        }
      ]
    })

    expect(pages?.[0].layout).toBe(12)
    expect(pages?.[0].items).toHaveLength(10)
  })

  test.each([
    ['no pages', { version: 3 }],
    ['a product without codes', { pages: [{ products: [{ price: '1,00' }] }] }],
    [
      'an invalid code',
      { pages: [{ products: [{ codes: ['../x'], price: '1,00' }] }] }
    ],
    [
      'an invalid price',
      { pages: [{ products: [{ codes: ['1'], price: 'x' }] }] }
    ]
  ])('refuses an export with %s', (_, exported) => {
    expect(getGenerationPagesFromExport(exported)).toBeUndefined()
  })
})

describe('resolveGenerationProduct', () => {
  test('finds the product by id first, then by its codes', () => {
    expect(
      resolveGenerationProduct(
        { productId: alcatra.id, codes: picanha.codes },
        (id) => products.find((product) => product.id === id),
        byCodes
      )
    ).toBe(alcatra)
    expect(
      resolveGenerationProduct(
        { productId: null, codes: [' 1001 '] },
        () => {},
        byCodes
      )
    ).toBe(picanha)
  })
})

describe('appendGenerationPages', () => {
  test('appends after the current pages, keeping the offer texts', () => {
    const { content, missingProductCount } = appendGenerationPages(
      offer(),
      [page([item(picanha, 2, 3990)])],
      { templateIds: ['mercado', 'acougue'], findProduct }
    )

    expect(missingProductCount).toBe(0)
    expect(content.validUntil).toBe('2026-11-19')
    expect(content.pages).toHaveLength(2)
    expect(content.pages[0]).toEqual(offer().pages[0])
    expect(content.pages[1]).toMatchObject({ templateId: 'acougue', layout: 4 })
    expect(content.pages[1].slots[2]).toEqual({
      product: picanha,
      priceInCents: 3990
    })
  })

  test('keeps one price per product, the one the offer already shows', () => {
    const { content } = appendGenerationPages(
      offer(),
      [
        page([item(alcatra, 0, 3990), item(picanha, 1, 3590)]),
        page([item(picanha, 0, 3790)])
      ],
      { templateIds: ['acougue'], findProduct }
    )

    expect(content.pages[1].slots[0]?.priceInCents).toBe(4290)
    expect(content.pages[1].slots[1]?.priceInCents).toBe(3590)
    expect(content.pages[2].slots[0]?.priceInCents).toBe(3590)
  })

  test('falls back to the first template and leaves missing products out', () => {
    const { content, missingProductCount } = appendGenerationPages(
      offer(),
      [
        {
          templateId: null,
          layout: null,
          items: [
            item(picanha, 0, 3990),
            { position: 1, productId: null, codes: ['9999'], priceInCents: 1 }
          ]
        }
      ],
      { templateIds: ['mercado'], findProduct }
    )

    expect(missingProductCount).toBe(1)
    expect(content.pages[1].templateId).toBe('mercado')
    expect(content.pages[1].layout).toBe(3)
    expect(content.pages[1].slots[1]).toBeNull()
  })
})

describe('selectGenerationPages', () => {
  const pages = [page([]), page([item(picanha, 0, 1)]), page([])]

  test('returns the chosen pages in order, once each', () => {
    expect(selectGenerationPages(pages, [3, 2, 3])).toEqual([
      pages[1],
      pages[2]
    ])
  })

  test.each([[[]], [[0]], [[4]], [[1.5]]])('refuses %j', (pageNumbers) => {
    expect(selectGenerationPages(pages, pageNumbers)).toBeUndefined()
  })
})
