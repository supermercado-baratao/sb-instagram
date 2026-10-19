// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { describe, expect, onTestFinished, test } from 'vitest'

import type { Product } from '@/domain/product'
import { migrationsFolder } from '@/infra/database/file'
import { products } from '@/infra/database/schema'

import { findProductByCode, saveProduct } from './product'

const EAN = '7891000100103'
const catalogProduct = {
  name: 'Leite Condensado',
  brand: 'Moça',
  unit: '395 g'
}

const savedProduct: Product = {
  code: EAN,
  codeType: 'ean',
  name: 'Leite Condensado Light',
  brand: 'Moça',
  unit: '395 g',
  photo: null
}

const setup = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'product-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))

  const catalog = path.join(directory, 'catalog')
  const photos = path.join(directory, 'photos')
  await mkdir(catalog)
  await writeFile(
    path.join(catalog, `${EAN}.json`),
    JSON.stringify(catalogProduct)
  )
  await writeFile(path.join(catalog, `${EAN}.png`), 'image')

  const database = drizzle({ client: new Database(':memory:') })
  migrate(database, { migrationsFolder })

  return { database, catalog, photos }
}

describe('findProductByCode', () => {
  test('prefers the product saved in the instance over the catalog', async () => {
    const { database, catalog } = await setup()
    database.insert(products).values(savedProduct).run()

    expect(await findProductByCode(database, EAN, { catalog })).toEqual({
      product: savedProduct,
      source: 'instance'
    })
  })

  test('falls back to the catalog for an EAN the instance does not know', async () => {
    const { database, catalog } = await setup()

    expect(await findProductByCode(database, ` ${EAN}\n`, { catalog })).toEqual(
      {
        product: { code: EAN, codeType: 'ean', ...catalogProduct, photo: null },
        source: 'catalog'
      }
    )
  })

  test('does not look up an internal code in the catalog', async () => {
    const { database, catalog } = await setup()
    await writeFile(
      path.join(catalog, '1234.json'),
      JSON.stringify(catalogProduct)
    )

    expect(await findProductByCode(database, '1234', { catalog })).toBe(
      undefined
    )
  })

  test('ignores a catalog file that breaks the schema', async () => {
    const { database, catalog } = await setup()
    await writeFile(path.join(catalog, `${EAN}.json`), '{"name":"Leite"}')

    expect(await findProductByCode(database, EAN, { catalog })).toBe(undefined)
  })

  test('returns nothing for an empty code', async () => {
    const { database, catalog } = await setup()

    expect(await findProductByCode(database, '  ', { catalog })).toBe(undefined)
  })
})

describe('saveProduct', () => {
  test('saves a catalog product with a copy of its photo', async () => {
    const { database, catalog, photos } = await setup()
    const found = await findProductByCode(database, EAN, { catalog })

    const saved = await saveProduct(database, found!, { catalog, photos })

    expect(saved.photo).toBe(`${EAN}.png`)
    expect(await readFile(path.join(photos, `${EAN}.png`), 'utf8')).toBe(
      'image'
    )
    expect(await findProductByCode(database, EAN, { catalog })).toEqual({
      product: {
        code: EAN,
        codeType: 'ean',
        ...catalogProduct,
        photo: `${EAN}.png`
      },
      source: 'instance'
    })
  })

  test('updates a product already saved and derives the code type', async () => {
    const { database, catalog, photos } = await setup()
    database.insert(products).values(savedProduct).run()

    await saveProduct(
      database,
      {
        product: { ...savedProduct, code: '1234', codeType: 'ean' },
        source: 'instance'
      },
      { catalog, photos }
    )
    await saveProduct(
      database,
      {
        product: { ...savedProduct, code: '1234', name: 'Picanha' },
        source: 'instance'
      },
      { catalog, photos }
    )

    expect(database.select().from(products).all()).toEqual([
      savedProduct,
      { ...savedProduct, code: '1234', codeType: 'internal', name: 'Picanha' }
    ])
  })
})
