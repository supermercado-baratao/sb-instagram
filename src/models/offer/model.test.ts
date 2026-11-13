// @vitest-environment node
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { describe, expect, test } from 'vitest'

import { migrationsFolder } from '@/infra/database/file'
import { relations } from '@/infra/database/relations'
import {
  offerBackup,
  offerPageItems,
  offers,
  productCodes,
  products
} from '@/infra/database/schema'
import { AppError } from '@/infra/errors'
import { PAGE_PRODUCT_COUNT } from '@/models/poster/poster'
import type { Product } from '@/models/product/product'

import { offerModel } from './model'
import { createOfferContent, type OfferContent } from './offer'

const product: Product = {
  id: '0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d',
  codes: ['7891000100103'],
  description: 'Leite Condensado Moça',
  unit: '395 g',
  voiceText: null,
  photo: null
}

type TestDatabase = ReturnType<typeof drizzle<typeof relations>>

const other: Product = {
  ...product,
  id: '7c1d2e3f-4a5b-4c6d-8e7f-0b6f3c1e5d2a',
  codes: ['7891000100110'],
  description: 'Creme de Leite'
}

const insertProduct = (database: TestDatabase, item: Product) => {
  const { codes, ...row } = item
  database.insert(products).values(row).run()
  database
    .insert(productCodes)
    .values(codes.map((code) => ({ productId: item.id, code })))
    .run()
}

const setup = () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const database = drizzle({ client: sqlite, relations })
  migrate(database, { migrationsFolder })
  insertProduct(database, product)
  return database
}

const withProduct = (): OfferContent => {
  const content = createOfferContent('mercado')
  content.pages[0].slots[2] = { product, priceInCents: 799 }
  content.pages.push({
    ...createOfferContent('acougue').pages[0],
    layout: 4
  })
  return content
}

describe('save and findCurrent', () => {
  test('keep pages in order and each product in its slot', () => {
    const database = setup()
    const content = withProduct()

    offerModel.save(database, content)

    expect(offerModel.findCurrent(database)).toEqual(content)
  })

  test('findCurrent returns nothing before the first save', () => {
    expect(offerModel.findCurrent(setup())).toBe(undefined)
  })

  test('saving again replaces the texts, pages and items of the single offer', () => {
    const database = setup()
    offerModel.save(database, withProduct())
    const changed = withProduct()
    changed.validUntil = '2026-10-31'
    changed.pages.reverse()
    changed.pages[1].slots = changed.pages[1].slots.toReversed()

    offerModel.save(database, changed)

    expect(offerModel.findCurrent(database)).toEqual(changed)
    expect(database.select().from(offers).all()).toHaveLength(1)
    expect(database.select().from(offerPageItems).all()).toHaveLength(1)
  })
})

describe('findOrCreate', () => {
  test('creates the offer once, on the given template', () => {
    const database = setup()

    const created = offerModel.findOrCreate(database, 'mercado')
    expect(created).toEqual(createOfferContent('mercado'))
    expect(offerModel.findOrCreate(database, 'acougue')).toEqual(created)
    expect(database.select().from(offers).all()).toHaveLength(1)
  })

  test('keeps the saved offer', () => {
    const database = setup()
    offerModel.save(database, withProduct())

    expect(offerModel.findOrCreate(database, 'mercado')).toEqual(withProduct())
  })
})

const withOther = (): OfferContent => {
  const content = withProduct()
  content.validUntil = '2026-11-12'
  content.pages[1].slots[0] = { product: other, priceInCents: 1299 }
  return content
}

describe('the offer backup', () => {
  test('keeps the version a save replaces', () => {
    const database = setup()
    insertProduct(database, other)
    offerModel.save(database, withProduct())

    offerModel.save(database, withOther())

    expect(offerModel.findBackup(database)).toEqual({
      replacedAt: expect.any(Number),
      pageCount: 2,
      productCount: 1,
      missingProductCount: 0
    })
  })

  test('is not written by the first save or a save that changes nothing', () => {
    const database = setup()
    offerModel.save(database, withProduct())
    offerModel.save(database, withProduct())

    expect(offerModel.findBackup(database)).toBe(undefined)
  })

  test('a save that changes nothing keeps the stored version', () => {
    const database = setup()
    insertProduct(database, other)
    offerModel.save(database, withProduct())
    offerModel.save(database, withOther())

    offerModel.save(database, withOther())
    offerModel.restoreBackup(database)

    expect(offerModel.findCurrent(database)).toEqual(withProduct())
  })

  test('restoring swaps the offer with the stored version, so restoring again undoes it', () => {
    const database = setup()
    insertProduct(database, other)
    offerModel.save(database, withProduct())
    offerModel.save(database, withOther())

    expect(offerModel.restoreBackup(database)).toEqual({
      content: withProduct(),
      missingProductCount: 0
    })
    expect(offerModel.findCurrent(database)).toEqual(withProduct())
    expect(offerModel.findBackup(database)).toMatchObject({ productCount: 2 })

    offerModel.restoreBackup(database)
    expect(offerModel.findCurrent(database)).toEqual(withOther())
  })

  test('restoring with nothing stored changes nothing', () => {
    const database = setup()
    offerModel.save(database, withProduct())

    expect(() => offerModel.restoreBackup(database)).toThrow(AppError)
    expect(offerModel.findCurrent(database)).toEqual(withProduct())
  })

  test('leaves out the products deleted after the version was stored', () => {
    const database = setup()
    insertProduct(database, other)
    offerModel.save(database, withOther())
    offerModel.save(database, createOfferContent('mercado'))
    // The stored version has no foreign key, so it never keeps a product from being deleted
    database.delete(productCodes).run()
    database.delete(products).run()

    expect(offerModel.findBackup(database)).toMatchObject({
      pageCount: 2,
      productCount: 0,
      missingProductCount: 2
    })
    expect(offerModel.restoreBackup(database)).toMatchObject({
      missingProductCount: 2
    })
    const restored = offerModel.findCurrent(database)
    expect(restored?.validUntil).toBe('2026-11-12')
    expect(restored?.pages.map((page) => page.layout)).toEqual([9, 4])
    expect(restored?.pages.flatMap((page) => page.slots)).toEqual(
      Array.from({ length: PAGE_PRODUCT_COUNT * 2 }, () => null)
    )
  })

  test('ignores a stored version that is not a valid offer', () => {
    const database = setup()
    offerModel.save(database, withProduct())
    database
      .insert(offerBackup)
      .values({
        id: 1,
        content: { pages: [] } as never,
        replacedAt: new Date()
      })
      .run()

    expect(offerModel.findBackup(database)).toBe(undefined)
    expect(() => offerModel.restoreBackup(database)).toThrow(AppError)
  })
})
