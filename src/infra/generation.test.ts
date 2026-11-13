// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { describe, expect, onTestFinished, test } from 'vitest'

import { migrationsFolder } from '@/infra/database/file'
import { relations } from '@/infra/database/relations'
import {
  generations,
  productCodes,
  products,
  templates
} from '@/infra/database/schema'
import { registerSearchText } from '@/infra/database/search-text'
import { savePronunciations } from '@/infra/pronunciation'
import { saveRadioScriptTemplate } from '@/infra/radio-script'
import { offerModel } from '@/models/offer/model'
import { createOfferContent, type OfferContent } from '@/models/offer/offer'
import type { Product } from '@/models/product/product'

import {
  copyGenerationPages,
  createGeneration,
  deleteGeneration,
  findGeneration,
  findGenerationExport,
  listGenerations,
  type OfferRenderer,
  removeUnfinishedGenerations
} from './generation'

const product: Product = {
  id: '0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d',
  codes: ['7891000100103'],
  description: 'Leite Condensado Moça',
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
  registerSearchText(sqlite)
  const database = drizzle({ client: sqlite, relations })
  migrate(database, { migrationsFolder })
  const { codes, ...row } = product
  database.insert(products).values(row).run()
  database
    .insert(productCodes)
    .values(codes.map((code) => ({ productId: product.id, code })))
    .run()
  database
    .insert(templates)
    .values({
      id: 'mercado',
      name: 'Mercado',
      primaryColor: '#1e3a8a',
      accentColor: '#dc2626',
      position: 0
    })
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

describe('createGeneration', () => {
  test('writes every page, the PDF and the export under the generation id', async () => {
    const { database, directory } = await setup()
    offerModel.save(database, twoPages())

    const generation = await createGeneration(database, renderer, {
      directory
    })

    expect(generation).toMatchObject({
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
      findGenerationExport(database, generation?.id ?? 0) ?? ''
    )
    expect(offerExport.pages[0].products).toEqual([
      expect.objectContaining({
        description: 'Leite Condensado Moça',
        price: '7,99'
      })
    ])
  })

  test('keeps what was generated when the product changes later', async () => {
    const { database, directory } = await setup()
    offerModel.save(database, twoPages())
    const generation = await createGeneration(database, renderer, {
      directory
    })

    database.update(products).set({ description: 'Creme de Leite' }).run()

    const offerExport = findGenerationExport(database, generation?.id ?? 0)
    expect(offerExport).toContain('Leite Condensado')
    expect(offerExport).not.toContain('Creme de Leite')
  })

  test('records the radio ad script with the saved template and dictionary', async () => {
    const { database, directory } = await setup()
    saveRadioScriptTemplate(database, {
      opening: 'Atenção!',
      closings: [],
      sequence: { start: [], middle: [], end: [] },
      priceMarkers: ['somente'],
      speakRepeatedOnce: true
    })
    savePronunciations(database, [{ term: 'Moça', spoken: 'Mossa' }])
    offerModel.save(database, twoPages())

    const generation = await createGeneration(database, renderer, {
      directory
    })

    expect(findGeneration(database, generation?.id ?? 0)?.radioScript).toEqual({
      version: 3,
      script:
        'Atenção!\n\n- leite condensado Mossa, trezentos e noventa e cinco gramas, somente: sete e noventa e nove',
      list: [
        {
          number: 1,
          text: 'leite condensado Mossa, trezentos e noventa e cinco gramas',
          price: '7,99'
        }
      ]
    })
  })

  test('numbers the generations in order, newest first', async () => {
    const { database, directory } = await setup()
    offerModel.save(database, twoPages())

    await createGeneration(database, renderer, { directory })
    offerModel.save(database, createOfferContent('mercado'))
    await createGeneration(database, renderer, { directory })

    expect(
      listGenerations(database).map(({ number, pageCount }) => ({
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
    offerModel.save(database, { ...twoPages(), validUntil: '2026-11-12' })
    await createGeneration(database, renderer, { directory })

    offerModel.save(database, { ...twoPages(), validUntil: null })
    await createGeneration(database, renderer, { directory })

    expect(
      listGenerations(database).map(({ validUntil }) => validUntil)
    ).toEqual([null, '2026-11-12'])
  })

  test('leaves no row or file when rendering fails', async () => {
    const { database, directory } = await setup()
    offerModel.save(database, twoPages())

    await expect(
      createGeneration(
        database,
        {
          ...renderer,
          renderPdf: () => Promise.reject(new Error('Chromium crashed'))
        },
        { directory }
      )
    ).rejects.toThrow('Chromium crashed')

    expect(listGenerations(database)).toEqual([])
    expect(await readdir(directory)).toEqual([])
  })

  test('returns undefined while the instance has no offer', async () => {
    const { database, directory } = await setup()

    expect(
      await createGeneration(database, renderer, { directory })
    ).toBeUndefined()
    expect(await readdir(directory)).toEqual([])
  })
})

describe('deleteGeneration', () => {
  test('removes the generation and its files, keeping the others', async () => {
    const { database, directory } = await setup()
    offerModel.save(database, twoPages())
    const first = await createGeneration(database, renderer, {
      directory
    })
    const second = await createGeneration(database, renderer, {
      directory
    })

    expect(
      await deleteGeneration(database, first?.id ?? 0, {
        directory
      })
    ).toBe(true)

    expect(listGenerations(database)).toEqual([second])
    expect(await readdir(directory)).toEqual([String(second?.id)])
  })

  test('answers false for an unknown id', async () => {
    const { database, directory } = await setup()

    expect(await deleteGeneration(database, 42, { directory })).toBe(false)
  })

  test('deleting the newest keeps its id out of later generations', async () => {
    const { database, directory } = await setup()
    offerModel.save(database, twoPages())
    const first = await createGeneration(database, renderer, { directory })
    await deleteGeneration(database, first?.id ?? 0, { directory })

    const next = await createGeneration(database, renderer, { directory })

    expect(next?.id).toBeGreaterThan(first?.id ?? 0)
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

const butchery = (): OfferContent => {
  const content = createOfferContent('mercado')
  content.pages[0] = {
    ...content.pages[0],
    layout: 4,
    slots: content.pages[0].slots.with(1, { product, priceInCents: 3990 })
  }
  return content
}

describe('copyGenerationPages', () => {
  test('appends the chosen pages after the current ones, keeping the generation', async () => {
    const { database, directory } = await setup()
    offerModel.save(database, { ...twoPages(), validUntil: '2026-11-12' })
    const generation = await createGeneration(database, renderer, {
      directory
    })
    offerModel.save(database, {
      ...createOfferContent('mercado'),
      validUntil: null
    })

    expect(copyGenerationPages(database, generation?.id ?? 0, [1])).toEqual({
      status: 'copied',
      pageCount: 1,
      missingProductCount: 0
    })

    const offer = offerModel.findCurrent(database)
    expect(offer?.validUntil).toBeNull()
    expect(offer?.pages).toHaveLength(2)
    expect(offer?.pages[1].slots[0]).toEqual({ product, priceInCents: 799 })
    expect(offerModel.findBackup(database)?.pageCount).toBe(1)
    expect(findGeneration(database, generation?.id ?? 0)?.pageCount).toBe(2)
  })

  test('keeps the layout and slot of each product', async () => {
    const { database, directory } = await setup()
    offerModel.save(database, butchery())
    const generation = await createGeneration(database, renderer, {
      directory
    })

    copyGenerationPages(database, generation?.id ?? 0, [1])

    const copied = offerModel.findCurrent(database)?.pages[1]
    expect(copied?.layout).toBe(4)
    expect(copied?.slots[1]?.product.id).toBe(product.id)
  })

  test('keeps the price the offer already shows for the same product', async () => {
    const { database, directory } = await setup()
    offerModel.save(database, butchery())
    const generation = await createGeneration(database, renderer, {
      directory
    })
    const current = butchery()
    current.pages[0].slots[1] = { product, priceInCents: 4290 }
    offerModel.save(database, current)

    copyGenerationPages(database, generation?.id ?? 0, [1])

    expect(
      offerModel.findCurrent(database)?.pages[1].slots[1]?.priceInCents
    ).toBe(4290)
  })

  test('finds the product by its codes when the id is gone', async () => {
    const { database, directory } = await setup()
    offerModel.save(database, butchery())
    const generation = await createGeneration(database, renderer, {
      directory
    })
    offerModel.save(database, createOfferContent('mercado'))
    database.delete(products).run()
    const { codes, ...row } = product
    const otherId = '9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
    database
      .insert(products)
      .values({ ...row, id: otherId })
      .run()
    database
      .insert(productCodes)
      .values(codes.map((code) => ({ productId: otherId, code })))
      .run()

    copyGenerationPages(database, generation?.id ?? 0, [1])

    expect(
      offerModel.findCurrent(database)?.pages[1].slots[1]?.product.id
    ).toBe(otherId)
  })

  test('leaves the slot of a product that no longer exists empty', async () => {
    const { database, directory } = await setup()
    offerModel.save(database, butchery())
    const generation = await createGeneration(database, renderer, {
      directory
    })
    offerModel.save(database, createOfferContent('mercado'))
    database.delete(products).run()

    expect(copyGenerationPages(database, generation?.id ?? 0, [1])).toEqual({
      status: 'copied',
      pageCount: 1,
      missingProductCount: 1
    })
    expect(
      offerModel.findCurrent(database)?.pages[1].slots.every((slot) => !slot)
    ).toBe(true)
  })

  test('rebuilds the pages of a generation recorded before they were stored', async () => {
    const { database, directory } = await setup()
    offerModel.save(database, butchery())
    const generation = await createGeneration(database, renderer, {
      directory
    })
    database.update(generations).set({ pages: null }).run()

    copyGenerationPages(database, generation?.id ?? 0, [1])

    const copied = offerModel.findCurrent(database)?.pages[1]
    expect(copied?.layout).toBe(3)
    expect(copied?.slots[0]).toEqual({ product, priceInCents: 3990 })
  })

  test('refuses a page the generation does not have', async () => {
    const { database, directory } = await setup()
    offerModel.save(database, twoPages())
    const generation = await createGeneration(database, renderer, {
      directory
    })

    expect(copyGenerationPages(database, generation?.id ?? 0, [3])).toEqual({
      status: 'missing'
    })
    expect(copyGenerationPages(database, 999, [1])).toEqual({
      status: 'missing'
    })
    expect(offerModel.findCurrent(database)?.pages).toHaveLength(2)
  })
})
