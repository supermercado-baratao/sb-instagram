// @vitest-environment node
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { describe, expect, test } from 'vitest'

import { createOfferContent, type OfferContent } from '@/domain/offer'
import type { Product } from '@/domain/product'
import { migrationsFolder } from '@/infra/database/file'
import { relations } from '@/infra/database/relations'
import { offerPageItems, productCodes, products } from '@/infra/database/schema'

import {
  createOffer,
  deleteOffer,
  duplicateOffer,
  findOffer,
  listOffers,
  saveOffer
} from './offer'

const product: Product = {
  id: '0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d',
  codes: ['7891000100103'],
  name: 'Leite Condensado',
  brand: 'Moça',
  unit: '395 g',
  voiceText: null,
  photo: null
}

const setup = () => {
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

describe('createOffer and findOffer', () => {
  test('keep pages in order and each product in its slot', () => {
    const database = setup()
    const content = withProduct()

    const id = createOffer(database, content)

    expect(findOffer(database, id)).toEqual({ id, ...content })
  })

  test('findOffer returns nothing for an unknown id', () => {
    expect(findOffer(setup(), 1)).toBe(undefined)
  })
})

describe('saveOffer', () => {
  test('replaces the texts, pages and items', () => {
    const database = setup()
    const id = createOffer(database, withProduct())
    const changed = withProduct()
    changed.name = 'Feirão'
    changed.validUntil = '2026-10-31'
    changed.pages.reverse()
    changed.pages[1].slots = changed.pages[1].slots.toReversed()

    expect(saveOffer(database, id, changed)).toBe(true)
    expect(findOffer(database, id)).toEqual({ id, ...changed })
    expect(database.select().from(offerPageItems).all()).toHaveLength(1)
  })

  test('returns false for an unknown id', () => {
    expect(saveOffer(setup(), 1, withProduct())).toBe(false)
  })
})

describe('duplicateOffer', () => {
  test('copies the offer under a new name', () => {
    const database = setup()
    const id = createOffer(database, withProduct())

    const copyId = duplicateOffer(database, id)

    expect(copyId).not.toBe(id)
    expect(findOffer(database, copyId!)).toEqual({
      ...withProduct(),
      id: copyId,
      name: 'Nova oferta (cópia)'
    })
  })

  test('returns nothing for an unknown id', () => {
    expect(duplicateOffer(setup(), 1)).toBe(undefined)
  })
})

describe('listOffers', () => {
  test('counts the pages of each offer, most recent first', () => {
    const database = setup()
    const first = createOffer(database, withProduct())
    const second = createOffer(database, createOfferContent('mercado'))

    expect(
      listOffers(database).map(({ id, pageCount }) => ({ id, pageCount }))
    ).toEqual([
      { id: second, pageCount: 1 },
      { id: first, pageCount: 2 }
    ])
  })
})

describe('deleteOffer', () => {
  test('removes the offer with its pages and items', () => {
    const database = setup()
    const id = createOffer(database, withProduct())

    deleteOffer(database, id)

    expect(listOffers(database)).toEqual([])
    expect(database.select().from(offerPageItems).all()).toEqual([])
  })
})
