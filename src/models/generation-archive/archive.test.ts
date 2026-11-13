import { describe, expect, test } from 'vitest'

import {
  createGenerationManifest,
  getGenerationArchiveEntry,
  hasEveryPage
} from './archive'
import { generationManifestSchema } from './schema'

const manifest = createGenerationManifest({
  number: 4,
  pageCount: 2,
  createdAt: new Date('2026-11-02T13:00:00.000Z'),
  radioScript: null,
  pages: null
})

const isGenerationManifest = (value: unknown) =>
  generationManifestSchema.safeParse(value).success

describe('generationManifestSchema', () => {
  test('accepts the manifest the app writes, with or without a radio script', () => {
    expect(isGenerationManifest(manifest)).toBe(true)
    expect(
      isGenerationManifest({
        ...manifest,
        radioScript: {
          version: 2,
          script: '- Feijão, por apenas: sete e oitenta e nove',
          list: [{ number: 1, text: 'Feijão', price: '7,89' }],
          unusedPages: [2],
          missingPageCount: 0
        }
      })
    ).toBe(true)
  })

  test('accepts the pages to copy, and a manifest written before them', () => {
    const pages = [
      {
        templateId: 'padrao',
        layout: 4,
        items: [
          {
            position: 0,
            productId: '6f1f8c1e-4a7b-4d8e-9a3a-1b2c3d4e5f60',
            codes: ['7891234567895'],
            priceInCents: 1290
          }
        ]
      }
    ]
    expect(isGenerationManifest({ ...manifest, pages })).toBe(true)
    expect(isGenerationManifest(manifest)).toBe(true)
    expect(isGenerationManifest({ ...manifest, pages: [{ items: [] }] })).toBe(
      false
    )
  })

  test('accepts a newer version, which the import refuses with its own message', () => {
    expect(isGenerationManifest({ ...manifest, version: 2 })).toBe(true)
  })

  test.each([
    ['another format', { ...manifest, format: 'sb-instagram-backup' }],
    ['no pages', { ...manifest, pageCount: 0 }],
    ['too many pages', { ...manifest, pageCount: 501 }],
    ['a fractional number', { ...manifest, number: 1.5 }],
    ['an invalid date', { ...manifest, createdAt: 'ontem' }],
    ['a broken radio script', { ...manifest, radioScript: { version: 2 } }],
    ['no radio script field', { ...manifest, radioScript: undefined }]
  ])('refuses %s', (_label, value) => {
    expect(isGenerationManifest(value)).toBe(false)
  })
})

describe('getGenerationArchiveEntry', () => {
  test.each([
    ['geracao.json', { type: 'manifest' }],
    ['ofertas.json', { type: 'offer-export' }],
    ['paginas.pdf', { type: 'pdf' }],
    ['roteiro.md', { type: 'radio-text' }],
    ['lista.md', { type: 'radio-text' }],
    ['pagina-12.png', { type: 'page', pageNumber: 12 }]
  ])('accepts %s', (name, entry) => {
    expect(getGenerationArchiveEntry(name)).toEqual(entry)
  })

  test.each([
    'pagina-0.png',
    'pagina-01.png',
    'pagina-501.png',
    'pagina-1.jpg',
    '../pagina-1.png',
    'geracao/pagina-1.png',
    'database.sqlite'
  ])('refuses %s', (name) => {
    expect(getGenerationArchiveEntry(name)).toBeUndefined()
  })
})

describe('hasEveryPage', () => {
  test('needs exactly the pages 1 to pageCount', () => {
    expect(hasEveryPage(new Set([1, 2]), 2)).toBe(true)
    expect(hasEveryPage(new Set([1]), 2)).toBe(false)
    expect(hasEveryPage(new Set([1, 3]), 2)).toBe(false)
    expect(hasEveryPage(new Set([1, 2, 3]), 2)).toBe(false)
  })
})
