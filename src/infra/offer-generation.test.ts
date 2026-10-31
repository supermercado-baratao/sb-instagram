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

import { createOffer, deleteOffer, duplicateOffer, saveOffer } from './offer'
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
  renderPage: async (offerId, pageNumber) =>
    new TextEncoder().encode(`png ${offerId} ${pageNumber}`),
  renderPdf: async (offerId) => new TextEncoder().encode(`pdf ${offerId}`)
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
    const offerId = createOffer(database, twoPages())

    const generation = await createOfferGeneration(
      database,
      offerId,
      renderer,
      {
        directory
      }
    )

    expect(generation).toMatchObject({ offerId, number: 1, pageCount: 2 })
    const folder = path.join(directory, String(generation?.id))
    const files = await readdir(folder)
    expect(files.toSorted((a, b) => a.localeCompare(b))).toEqual([
      'pagina-1.png',
      'pagina-2.png',
      'paginas.pdf'
    ])
    expect(await readFile(path.join(folder, 'pagina-2.png'), 'utf8')).toBe(
      `png ${offerId} 2`
    )
    const offerExport = JSON.parse(
      findOfferGenerationExport(database, offerId, generation?.id ?? 0) ?? ''
    )
    expect(offerExport.pages[0].products).toEqual([
      expect.objectContaining({ name: 'Leite Condensado', price: '7,99' })
    ])
  })

  test('keeps what was generated when the product changes later', async () => {
    const { database, directory } = await setup()
    const offerId = createOffer(database, twoPages())
    const generation = await createOfferGeneration(
      database,
      offerId,
      renderer,
      {
        directory
      }
    )

    database.update(products).set({ name: 'Creme de Leite' }).run()

    const offerExport = findOfferGenerationExport(
      database,
      offerId,
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
    const offerId = createOffer(database, twoPages())

    const generation = await createOfferGeneration(
      database,
      offerId,
      renderer,
      { directory }
    )

    expect(
      findOfferGeneration(database, offerId, generation?.id ?? 0)?.radioScript
    ).toEqual({
      version: 2,
      offerName: 'Nova oferta',
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

  test('numbers the generations of each offer in order, newest first', async () => {
    const { database, directory } = await setup()
    const offerId = createOffer(database, twoPages())
    const otherId = createOffer(database, twoPages())

    await createOfferGeneration(database, offerId, renderer, { directory })
    await createOfferGeneration(database, otherId, renderer, { directory })
    saveOffer(database, offerId, createOfferContent('mercado'))
    await createOfferGeneration(database, offerId, renderer, { directory })

    expect(
      listOfferGenerations(database, offerId).map(({ number, pageCount }) => ({
        number,
        pageCount
      }))
    ).toEqual([
      { number: 2, pageCount: 1 },
      { number: 1, pageCount: 2 }
    ])
    expect(listOfferGenerations(database, otherId)).toHaveLength(1)
  })

  test('leaves no row or file when rendering fails', async () => {
    const { database, directory } = await setup()
    const offerId = createOffer(database, twoPages())

    await expect(
      createOfferGeneration(
        database,
        offerId,
        {
          ...renderer,
          renderPdf: () => Promise.reject(new Error('Chromium crashed'))
        },
        { directory }
      )
    ).rejects.toThrow('Chromium crashed')

    expect(listOfferGenerations(database, offerId)).toEqual([])
    expect(await readdir(directory)).toEqual([])
  })

  test('returns undefined for an offer that no longer exists', async () => {
    const { database, directory } = await setup()

    expect(
      await createOfferGeneration(database, 42, renderer, { directory })
    ).toBeUndefined()
    expect(await readdir(directory)).toEqual([])
  })
})

describe('findOfferGeneration', () => {
  test('only finds a generation through its own offer', async () => {
    const { database, directory } = await setup()
    const offerId = createOffer(database, twoPages())
    const otherId = createOffer(database, twoPages())
    const generation = await createOfferGeneration(
      database,
      offerId,
      renderer,
      {
        directory
      }
    )
    const id = generation?.id ?? 0

    expect(findOfferGeneration(database, offerId, id)).toEqual(generation)
    expect(findOfferGeneration(database, otherId, id)).toBeUndefined()
    expect(findOfferGenerationExport(database, otherId, id)).toBeUndefined()
  })
})

describe('deleteOfferGeneration', () => {
  test('removes the generation and its files, keeping the others', async () => {
    const { database, directory } = await setup()
    const offerId = createOffer(database, twoPages())
    const first = await createOfferGeneration(database, offerId, renderer, {
      directory
    })
    const second = await createOfferGeneration(database, offerId, renderer, {
      directory
    })

    expect(
      await deleteOfferGeneration(database, offerId, first?.id ?? 0, {
        directory
      })
    ).toBe(true)

    expect(listOfferGenerations(database, offerId)).toEqual([second])
    expect(await readdir(directory)).toEqual([String(second?.id)])
  })

  test('refuses a generation of another offer', async () => {
    const { database, directory } = await setup()
    const offerId = createOffer(database, twoPages())
    const otherId = createOffer(database, twoPages())
    const generation = await createOfferGeneration(
      database,
      offerId,
      renderer,
      {
        directory
      }
    )

    expect(
      await deleteOfferGeneration(database, otherId, generation?.id ?? 0, {
        directory
      })
    ).toBe(false)
    expect(listOfferGenerations(database, offerId)).toHaveLength(1)
  })
})

describe('deleteOffer and duplicateOffer', () => {
  test('deleting an offer removes its generations and their files', async () => {
    const { database, directory } = await setup()
    const offerId = createOffer(database, twoPages())
    const otherId = createOffer(database, twoPages())
    await createOfferGeneration(database, offerId, renderer, { directory })
    const kept = await createOfferGeneration(database, otherId, renderer, {
      directory
    })

    await deleteOffer(database, offerId, { generations: directory })

    expect(listOfferGenerations(database, offerId)).toEqual([])
    expect(await readdir(directory)).toEqual([String(kept?.id)])
  })

  test('a copy of an offer starts without generations', async () => {
    const { database, directory } = await setup()
    const offerId = createOffer(database, twoPages())
    await createOfferGeneration(database, offerId, renderer, { directory })

    const copyId = duplicateOffer(database, offerId) ?? 0

    expect(listOfferGenerations(database, copyId)).toEqual([])
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
