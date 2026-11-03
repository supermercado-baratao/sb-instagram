// @vitest-environment node
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { describe, expect, test } from 'vitest'

import { createOfferContent, type OfferContent } from '@/domain/offer'
import type { Product } from '@/domain/product'
import { migrationsFolder } from '@/infra/database/file'
import { relations } from '@/infra/database/relations'
import {
  offerPageItems,
  offers,
  productCodes,
  products
} from '@/infra/database/schema'

import { findOffer, findOrCreateOffer, saveOffer } from './offer'

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

describe('saveOffer and findOffer', () => {
  test('keep pages in order and each product in its slot', () => {
    const database = setup()
    const content = withProduct()

    saveOffer(database, content)

    expect(findOffer(database)).toEqual(content)
  })

  test('findOffer returns nothing before the first save', () => {
    expect(findOffer(setup())).toBe(undefined)
  })

  test('saving again replaces the texts, pages and items of the single offer', () => {
    const database = setup()
    saveOffer(database, withProduct())
    const changed = withProduct()
    changed.validUntil = '2026-10-31'
    changed.pages.reverse()
    changed.pages[1].slots = changed.pages[1].slots.toReversed()

    saveOffer(database, changed)

    expect(findOffer(database)).toEqual(changed)
    expect(database.select().from(offers).all()).toHaveLength(1)
    expect(database.select().from(offerPageItems).all()).toHaveLength(1)
  })
})

describe('findOrCreateOffer', () => {
  test('creates the offer once, on the given template', () => {
    const database = setup()

    const created = findOrCreateOffer(database, 'mercado')
    expect(created).toEqual(createOfferContent('mercado'))
    expect(findOrCreateOffer(database, 'acougue')).toEqual(created)
    expect(database.select().from(offers).all()).toHaveLength(1)
  })

  test('keeps the saved offer', () => {
    const database = setup()
    saveOffer(database, withProduct())

    expect(findOrCreateOffer(database, 'mercado')).toEqual(withProduct())
  })
})
