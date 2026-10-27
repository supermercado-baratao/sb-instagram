// @vitest-environment node
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { describe, expect, onTestFinished, test } from 'vitest'

import { type Product, PRODUCTS_PAGE_SIZE } from '@/domain/product'
import { migrationsFolder } from '@/infra/database/file'
import {
  offerPageItems,
  offerPages,
  offers,
  productCodes,
  products
} from '@/infra/database/schema'
import { registerSearchText } from '@/infra/database/search-text'

import {
  CodeConflictError,
  deleteProduct,
  findCodeConflicts,
  findProductByCode,
  listProducts,
  saveProduct,
  searchProducts
} from './product'

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

  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  registerSearchText(sqlite)
  const database = drizzle({ client: sqlite })
  migrate(database, { migrationsFolder })

  return { database, catalog, photos }
}

const product = (code: string, name: string): Product => ({
  ...savedProduct,
  code,
  codeType: 'internal',
  name
})

const listCodes = (database: Awaited<ReturnType<typeof setup>>['database']) =>
  database
    .select()
    .from(productCodes)
    .orderBy(productCodes.code)
    .all()
    .map(({ code }) => code)

describe('findProductByCode', () => {
  test('prefers the product saved in the instance over the catalog', async () => {
    const { database, catalog } = await setup()
    database.insert(products).values(savedProduct).run()

    expect(await findProductByCode(database, EAN, { catalog })).toEqual({
      product: savedProduct,
      source: 'instance',
      extraCodes: []
    })
  })

  test('finds a product by one of its extra codes', async () => {
    const { database, catalog } = await setup()
    database.insert(products).values(savedProduct).run()
    database
      .insert(productCodes)
      .values([
        { code: '7891000053508', productCode: EAN },
        { code: '2001', productCode: EAN }
      ])
      .run()

    expect(await findProductByCode(database, ' 2001', { catalog })).toEqual({
      product: savedProduct,
      source: 'instance',
      extraCodes: ['2001', '7891000053508']
    })
  })

  test('falls back to the catalog for an EAN the instance does not know', async () => {
    const { database, catalog } = await setup()

    expect(await findProductByCode(database, ` ${EAN}\n`, { catalog })).toEqual(
      {
        product: { code: EAN, codeType: 'ean', ...catalogProduct, photo: null },
        source: 'catalog',
        extraCodes: []
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
      source: 'instance',
      extraCodes: []
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

  test('replaces the extra codes only when they are given', async () => {
    const { database, catalog, photos } = await setup()
    const found = { product: savedProduct, source: 'instance' } as const

    await saveProduct(database, found, {
      catalog,
      photos,
      extraCodes: [' 2001', '2002', '2001', EAN, '']
    })
    expect(listCodes(database)).toEqual(['2001', '2002'])

    await saveProduct(database, found, { catalog, photos })
    expect(listCodes(database)).toEqual(['2001', '2002'])

    await saveProduct(database, found, {
      catalog,
      photos,
      extraCodes: ['2003']
    })
    expect(listCodes(database)).toEqual(['2003'])
  })

  test('refuses a code that belongs to another product', async () => {
    const { database, catalog, photos } = await setup()
    database
      .insert(products)
      .values([savedProduct, product('1234', 'Picanha')])
      .run()
    database
      .insert(productCodes)
      .values({ code: '2001', productCode: '1234' })
      .run()
    const found = { product: savedProduct, source: 'instance' } as const

    for (const extraCodes of [['1234'], ['2001']]) {
      await expect(
        saveProduct(database, found, { catalog, photos, extraCodes })
      ).rejects.toThrow(CodeConflictError)
    }
    await expect(
      saveProduct(
        database,
        { product: product('2001', 'Alcatra'), source: 'instance' },
        { catalog, photos }
      )
    ).rejects.toThrow(CodeConflictError)
    expect(database.select().from(products).all()).toHaveLength(2)
    expect(listCodes(database)).toEqual(['2001'])
  })

  test('rejects an extra code that could name a file outside the photos folder', async () => {
    const { database, catalog, photos } = await setup()

    await expect(
      saveProduct(
        database,
        { product: savedProduct, source: 'instance' },
        { catalog, photos, extraCodes: ['../logo'] }
      )
    ).rejects.toThrow()
  })
})

describe('findCodeConflicts', () => {
  test('names the product that already has each code', async () => {
    const { database } = await setup()
    database
      .insert(products)
      .values([savedProduct, product('1234', 'Picanha')])
      .run()
    database
      .insert(productCodes)
      .values([
        { code: '2001', productCode: '1234' },
        { code: '2002', productCode: EAN }
      ])
      .run()

    expect(
      findCodeConflicts(database, EAN, ['1234', '2001', '2002', EAN, '3000'])
    ).toEqual([
      { code: '1234', product: { code: '1234', name: 'Picanha' } },
      { code: '2001', product: { code: '1234', name: 'Picanha' } }
    ])
  })
})

describe('listProducts', () => {
  test('searches the name ignoring case and the code by any part', async () => {
    const { database } = await setup()
    database
      .insert(products)
      .values([
        product('1001', 'picanha bovina'),
        product('2002', 'Alcatra'),
        product('3010', 'Fraldinha')
      ])
      .run()

    const names = (query: string) =>
      listProducts(database, { query }).products.map(({ name }) => name)

    expect(names('PICANHA')).toEqual(['picanha bovina'])
    expect(names(' 01 ')).toEqual(['Fraldinha', 'picanha bovina'])
    expect(names('')).toEqual(['Alcatra', 'Fraldinha', 'picanha bovina'])
  })

  test('searches and sorts the name ignoring accents and cedilla', async () => {
    const { database } = await setup()
    database
      .insert(products)
      .values([
        product('1', 'Pão Francês'),
        product('2', 'pão de queijo'),
        product('3', 'Açúcar Cristal'),
        product('4', 'Ágata Azeite'),
        product('5', 'Batata')
      ])
      .run()

    const names = (query: string) =>
      listProducts(database, { query }).products.map(({ name }) => name)

    expect(names('pao')).toEqual(['pão de queijo', 'Pão Francês'])
    expect(names('PÃO DE')).toEqual(['pão de queijo'])
    expect(names('acucar')).toEqual(['Açúcar Cristal'])
    expect(names('ÇÚ')).toEqual(['Açúcar Cristal'])
    expect(names('')).toEqual([
      'Açúcar Cristal',
      'Ágata Azeite',
      'Batata',
      'pão de queijo',
      'Pão Francês'
    ])
  })

  test('takes % and _ in the query literally', async () => {
    const { database } = await setup()
    database
      .insert(products)
      .values([product('1', 'Desconto 50%'), product('2', 'Arroz 5 kg')])
      .run()

    expect(
      listProducts(database, { query: '50%' }).products.map(({ code }) => code)
    ).toEqual(['1'])
    expect(listProducts(database, { query: '_' }).total).toBe(0)
  })

  test('pages the products and keeps the page within range', async () => {
    const { database } = await setup()
    database
      .insert(products)
      .values(
        Array.from({ length: PRODUCTS_PAGE_SIZE + 1 }, (_, index) =>
          product(String(index), `Produto ${String(index).padStart(3, '0')}`)
        )
      )
      .run()

    const first = listProducts(database)
    expect(first).toMatchObject({ total: 51, page: 1, pageCount: 2 })
    expect(first.products).toHaveLength(PRODUCTS_PAGE_SIZE)

    const last = listProducts(database, { page: 2 })
    expect(last.products.map(({ code }) => code)).toEqual(['50'])
    expect(listProducts(database, { page: 9 }).page).toBe(2)
    expect(listProducts(database, { page: NaN }).page).toBe(1)
    expect(listProducts(database, { page: -1 }).page).toBe(1)
  })

  test('answers one empty page when nothing matches', async () => {
    const { database } = await setup()

    expect(listProducts(database, { query: 'picanha', page: 3 })).toEqual({
      products: [],
      total: 0,
      page: 1,
      pageCount: 1
    })
  })
})

describe('searchProducts', () => {
  test('matches every word in the name, brand, unit or code ignoring accents', async () => {
    const { database } = await setup()
    database
      .insert(products)
      .values([
        {
          ...product('7891', 'Sabonete Erva-Doce'),
          brand: 'Albany',
          unit: '85 g'
        },
        { ...product('7892', 'Sabonete Aveia'), brand: 'Lux', unit: '85 g' },
        { ...product('ab-1', 'Pão Francês'), brand: null, unit: null }
      ])
      .run()

    const codes = (query: string) =>
      searchProducts(database, query).map(({ code }) => code)

    expect(codes('sabonete')).toEqual(['7892', '7891'])
    expect(codes('SABONETE  albany')).toEqual(['7891'])
    expect(codes('85 G')).toEqual(['7892', '7891'])
    expect(codes('7892')).toEqual(['7892'])
    expect(codes('AB-1')).toEqual(['ab-1'])
    expect(codes('pao frances')).toEqual(['ab-1'])
    expect(codes('pao albany')).toEqual([])
    expect(codes('  ')).toEqual([])
  })

  test('takes % and _ literally and stops at the limit', async () => {
    const { database } = await setup()
    database
      .insert(products)
      .values(
        Array.from({ length: 3 }, (_, index) =>
          product(String(index), `Produto ${index}`)
        )
      )
      .run()

    expect(searchProducts(database, '%')).toEqual([])
    expect(searchProducts(database, '_')).toEqual([])
    expect(
      searchProducts(database, 'produto', { limit: 2 }).map(({ code }) => code)
    ).toEqual(['0', '1'])
  })
})

const addOffer = (
  database: Awaited<ReturnType<typeof setup>>['database'],
  name: string,
  codes: string[]
) => {
  const offer = database
    .insert(offers)
    .values({ name, highlightTitle: '', highlightMessage: '' })
    .returning()
    .get()
  for (const [position, code] of codes.entries()) {
    const page = database
      .insert(offerPages)
      .values({
        offerId: offer.id,
        position,
        templateId: 'mercado',
        layout: 4
      })
      .returning()
      .get()
    database
      .insert(offerPageItems)
      .values({
        pageId: page.id,
        position: 0,
        productCode: code,
        priceInCents: 100
      })
      .run()
  }
}

describe('deleteProduct', () => {
  test('deletes the product and its photo', async () => {
    const { database, photos } = await setup()
    database
      .insert(products)
      .values([
        { ...savedProduct, photo: `${EAN}.png` },
        product('1234', 'Picanha')
      ])
      .run()
    await mkdir(photos)
    await writeFile(path.join(photos, `${EAN}.png`), 'image')

    expect(await deleteProduct(database, ` ${EAN}`, { photos })).toEqual({
      status: 'deleted'
    })
    expect(database.select().from(products).all()).toEqual([
      product('1234', 'Picanha')
    ])
    await expect(access(path.join(photos, `${EAN}.png`))).rejects.toThrow()
  })

  test('deletes a product without a photo', async () => {
    const { database, photos } = await setup()
    database.insert(products).values(product('1234', 'Picanha')).run()

    expect(await deleteProduct(database, '1234', { photos })).toEqual({
      status: 'deleted'
    })
    expect(database.select().from(products).all()).toEqual([])
  })

  test('deletes the extra codes with the product', async () => {
    const { database, photos } = await setup()
    database
      .insert(products)
      .values([savedProduct, product('1234', 'Picanha')])
      .run()
    database
      .insert(productCodes)
      .values([
        { code: '2001', productCode: EAN },
        { code: '2002', productCode: '1234' }
      ])
      .run()

    await deleteProduct(database, EAN, { photos })

    expect(listCodes(database)).toEqual(['2002'])
  })

  test('refuses a product used in offers and names each offer once', async () => {
    const { database, photos } = await setup()
    database
      .insert(products)
      .values([
        { ...savedProduct, photo: `${EAN}.png` },
        product('1234', 'Picanha')
      ])
      .run()
    await mkdir(photos)
    await writeFile(path.join(photos, `${EAN}.png`), 'image')
    addOffer(database, 'Semana', [EAN, EAN])
    addOffer(database, 'Açougue', ['1234'])
    addOffer(database, 'Fim de semana', ['1234', EAN])

    expect(await deleteProduct(database, EAN, { photos })).toEqual({
      status: 'in-use',
      offers: ['Fim de semana', 'Semana']
    })
    expect(database.select().from(products).all()).toHaveLength(2)
    expect(await readFile(path.join(photos, `${EAN}.png`), 'utf8')).toBe(
      'image'
    )
  })

  test('rejects a code that could name a file outside the photos folder', async () => {
    const { database, photos } = await setup()

    await expect(
      deleteProduct(database, '../logo', { photos })
    ).rejects.toThrow()
  })
})
