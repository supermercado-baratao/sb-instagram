// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { describe, expect, onTestFinished, test } from 'vitest'

import { createOfferContent, type OfferContent } from '@/domain/offer'
import type { Product } from '@/domain/product'
import { migrationsFolder } from '@/infra/database/file'
import { relations } from '@/infra/database/relations'
import { productCodes, products } from '@/infra/database/schema'
import { savePronunciations } from '@/infra/pronunciation'
import { saveRadioScriptTemplate } from '@/infra/radio-script'

import { OFFER_ID, saveOffer } from './offer'
import {
  createOfferGeneration,
  deleteOfferGeneration,
  findOfferGeneration,
  findOfferGenerationExport,
  listOfferGenerations,
  type OfferRenderer,
  removeUnfinishedGenerations
} from './offer-generation'

const product: Product = {
  id: '0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d',
  codes: ['7891000100103'],
  name: 'Leite Condensado',
  brand: 'Moça',
  unit: '395 g',
  voiceText: null,
  photo: null
}

const renderer: OfferRenderer = {
  renderPage: async (pageNumber) =>
    new TextEncoder().encode(`png ${pageNumber}`),
  renderPdf: async () => new TextEncoder().encode('pdf')
}

const setup = async () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const database = drizzle({ client: sqlite, relations })
  migrate(database, { migrationsFolder })
  const { codes, ...row } = product
  database.insert(products).values(row).run()
  database
    .insert(productCodes)
    .values(codes.map((code) => ({ productId: product.id, code })))
    .run()

  const directory = await mkdtemp(path.join(tmpdir(), 'generations-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))

  return { database, directory }
}

const twoPages = (): OfferContent => {
  const content = createOfferContent('mercado')
  content.pages[0].slots[0] = { product, priceInCents: 799 }
  content.pages.push(createOfferContent('mercado').pages[0])
  return content
}

describe('createOfferGeneration', () => {
  test('writes every page, the PDF and the export under the generation id', async () => {
    const { database, directory } = await setup()
    saveOffer(database, twoPages())

    const generation = await createOfferGeneration(database, renderer, {
      directory
    })

    expect(generation).toMatchObject({
      offerId: OFFER_ID,
      number: 1,
      pageCount: 2
    })
    const folder = path.join(directory, String(generation?.id))
    const files = await readdir(folder)
    expect(files.toSorted((a, b) => a.localeCompare(b))).toEqual([
      'pagina-1.png',
      'pagina-2.png',
      'paginas.pdf'
    ])
    expect(await readFile(path.join(folder, 'pagina-2.png'), 'utf8')).toBe(
      'png 2'
    )
    const offerExport = JSON.parse(
      findOfferGenerationExport(database, OFFER_ID, generation?.id ?? 0) ?? ''
    )
    expect(offerExport.pages[0].products).toEqual([
      expect.objectContaining({ name: 'Leite Condensado', price: '7,99' })
    ])
  })

  test('keeps what was generated when the product changes later', async () => {
    const { database, directory } = await setup()
    saveOffer(database, twoPages())
    const generation = await createOfferGeneration(database, renderer, {
      directory
    })

    database.update(products).set({ name: 'Creme de Leite' }).run()

    const offerExport = findOfferGenerationExport(
      database,
      OFFER_ID,
      generation?.id ?? 0
    )
    expect(offerExport).toContain('Leite Condensado')
    expect(offerExport).not.toContain('Creme de Leite')
  })

  test('records the radio ad script with the saved template and dictionary', async () => {
    const { database, directory } = await setup()
    saveRadioScriptTemplate(database, {
      blocks: [
        { type: 'text', text: 'Atenção!' },
        { type: 'products', pageCount: 1 }
      ],
      priceMarkers: ['somente']
    })
    savePronunciations(database, [{ term: 'Moça', spoken: 'Mossa' }])
    saveOffer(database, twoPages())

    const generation = await createOfferGeneration(database, renderer, {
      directory
    })

    expect(
      findOfferGeneration(database, OFFER_ID, generation?.id ?? 0)?.radioScript
    ).toEqual({
      version: 2,
      script:
        'Atenção!\n\n- Leite Condensado Mossa trezentos e noventa e cinco gramas, somente: sete e noventa e nove',
      list: [
        {
          number: 1,
          text: 'Leite Condensado Mossa trezentos e noventa e cinco gramas',
          price: '7,99'
        }
      ],
      unusedPages: [],
      missingPageCount: 0
    })
  })

  test('numbers the generations in order, newest first', async () => {
    const { database, directory } = await setup()
    saveOffer(database, twoPages())

    await createOfferGeneration(database, renderer, { directory })
    saveOffer(database, createOfferContent('mercado'))
    await createOfferGeneration(database, renderer, { directory })

    expect(
      listOfferGenerations(database, OFFER_ID).map(({ number, pageCount }) => ({
        number,
        pageCount
      }))
    ).toEqual([
      { number: 2, pageCount: 1 },
      { number: 1, pageCount: 2 }
    ])
  })

  test('keeps the validity it was generated with', async () => {
    const { database, directory } = await setup()
    saveOffer(database, { ...twoPages(), validUntil: '2026-11-12' })
    await createOfferGeneration(database, renderer, { directory })

    saveOffer(database, { ...twoPages(), validUntil: null })
    await createOfferGeneration(database, renderer, { directory })

    expect(
      listOfferGenerations(database, OFFER_ID).map(
        ({ validUntil }) => validUntil
      )
    ).toEqual([null, '2026-11-12'])
  })

  test('leaves no row or file when rendering fails', async () => {
    const { database, directory } = await setup()
    saveOffer(database, twoPages())

    await expect(
      createOfferGeneration(
        database,
        {
          ...renderer,
          renderPdf: () => Promise.reject(new Error('Chromium crashed'))
        },
        { directory }
      )
    ).rejects.toThrow('Chromium crashed')

    expect(listOfferGenerations(database, OFFER_ID)).toEqual([])
    expect(await readdir(directory)).toEqual([])
  })

  test('returns undefined while the instance has no offer', async () => {
    const { database, directory } = await setup()

    expect(
      await createOfferGeneration(database, renderer, { directory })
    ).toBeUndefined()
    expect(await readdir(directory)).toEqual([])
  })
})

describe('findOfferGeneration', () => {
  test('only finds a generation through its own offer', async () => {
    const { database, directory } = await setup()
    saveOffer(database, twoPages())
    const otherId = OFFER_ID + 1
    const generation = await createOfferGeneration(database, renderer, {
      directory
    })
    const id = generation?.id ?? 0

    expect(findOfferGeneration(database, OFFER_ID, id)).toEqual(generation)
    expect(findOfferGeneration(database, otherId, id)).toBeUndefined()
    expect(findOfferGenerationExport(database, otherId, id)).toBeUndefined()
  })
})

describe('deleteOfferGeneration', () => {
  test('removes the generation and its files, keeping the others', async () => {
    const { database, directory } = await setup()
    saveOffer(database, twoPages())
    const first = await createOfferGeneration(database, renderer, {
      directory
    })
    const second = await createOfferGeneration(database, renderer, {
      directory
    })

    expect(
      await deleteOfferGeneration(database, OFFER_ID, first?.id ?? 0, {
        directory
      })
    ).toBe(true)

    expect(listOfferGenerations(database, OFFER_ID)).toEqual([second])
    expect(await readdir(directory)).toEqual([String(second?.id)])
  })

  test('refuses a generation of another offer', async () => {
    const { database, directory } = await setup()
    saveOffer(database, twoPages())
    const otherId = OFFER_ID + 1
    const generation = await createOfferGeneration(database, renderer, {
      directory
    })

    expect(
      await deleteOfferGeneration(database, otherId, generation?.id ?? 0, {
        directory
      })
    ).toBe(false)
    expect(listOfferGenerations(database, OFFER_ID)).toHaveLength(1)
  })
})

describe('removeUnfinishedGenerations', () => {
  test('removes temporary folders and keeps finished generations', async () => {
    const { directory } = await setup()
    await mkdir(path.join(directory, '.tmp-interrupted'))
    await mkdir(path.join(directory, '7'))

    await removeUnfinishedGenerations(directory)

    expect(await readdir(directory)).toEqual(['7'])
  })

  test('ignores a missing folder', async () => {
    const { directory } = await setup()

    await expect(
      removeUnfinishedGenerations(path.join(directory, 'missing'))
    ).resolves.toBeUndefined()
  })
})
