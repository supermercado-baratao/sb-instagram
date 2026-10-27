// @vitest-environment node
import { randomUUID } from 'node:crypto'
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
  deleteProduct,
  DuplicateCodesError,
  findProductById,
  findProductsByCode,
  findProductWithCodes,
  listProducts,
  MissingProductError,
  renameOutdatedPhotos,
  saveProduct,
  searchProducts
} from './product'

const EAN = '7891000100103'
const catalogProduct = {
  name: 'Leite Condensado',
  brand: 'Moça',
  unit: '395 g'
}

const setup = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'product-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))

  const catalog = path.join(directory, 'catalog')
  const photos = path.join(directory, 'photos')
  await mkdir(catalog)
  await mkdir(photos)
  await writeFile(
    path.join(catalog, `${EAN}.json`),
    JSON.stringify(catalogProduct)
  )
  await writeFile(path.join(catalog, `${EAN}.png`), 'catalog image')

  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  registerSearchText(sqlite)
  const database = drizzle({ client: sqlite })
  migrate(database, { migrationsFolder })

  const addProduct = (
    codes: string[],
    name: string,
    details: Partial<Omit<Product, 'id' | 'codes' | 'name'>> = {}
  ): Product => {
    const product: Product = {
      id: randomUUID(),
      codes: codes.toSorted((a, b) => a.localeCompare(b)),
      name,
      brand: null,
      unit: null,
      photo: null,
      ...details
    }
    database
      .insert(products)
      .values({
        id: product.id,
        name: product.name,
        brand: product.brand,
        unit: product.unit,
        photo: product.photo
      })
      .run()
    database
      .insert(productCodes)
      .values(codes.map((code) => ({ productId: product.id, code })))
      .run()
    return product
  }

  const readPhoto = (fileName: string) =>
    readFile(path.join(photos, fileName), 'utf8')

  return { database, catalog, photos, addProduct, readPhoto }
}

const exists = async (file: string) => {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

describe('findProductsByCode', () => {
  test('finds a product of the instance by any of its codes', async () => {
    const { database, catalog, addProduct } = await setup()
    const product = addProduct(['2001', EAN], 'Sabonete')

    expect(await findProductsByCode(database, ' 2001', { catalog })).toEqual({
      source: 'instance',
      products: [product]
    })
  })

  test('puts the single product before the groups with its code, smaller first', async () => {
    const { database, catalog, addProduct } = await setup()
    const all = addProduct(['2001', '2002', '2003'], 'Sabonete todas')
    const single = addProduct(['2001'], 'Sabonete lavanda')
    const pair = addProduct(['2001', '2002'], 'Sabonete lavanda e erva-doce')
    addProduct(['2002'], 'Sabonete erva-doce')

    const found = await findProductsByCode(database, '2001', { catalog })

    expect(found).toEqual({ source: 'instance', products: [single, pair, all] })
  })

  test('falls back to the catalog for an EAN the instance does not know', async () => {
    const { database, catalog } = await setup()

    expect(
      await findProductsByCode(database, ` ${EAN}\n`, { catalog })
    ).toEqual({ source: 'catalog', product: { code: EAN, ...catalogProduct } })
  })

  test('does not look up an internal code in the catalog', async () => {
    const { database, catalog } = await setup()
    await writeFile(
      path.join(catalog, '1234.json'),
      JSON.stringify(catalogProduct)
    )

    expect(await findProductsByCode(database, '1234', { catalog })).toBe(
      undefined
    )
  })

  test('ignores a catalog file that breaks the schema', async () => {
    const { database, catalog } = await setup()
    await writeFile(path.join(catalog, `${EAN}.json`), '{"name":"Leite"}')

    expect(await findProductsByCode(database, EAN, { catalog })).toBe(undefined)
  })

  test('returns nothing for an empty code', async () => {
    const { database, catalog } = await setup()

    expect(await findProductsByCode(database, '  ', { catalog })).toBe(
      undefined
    )
  })
})

describe('findProductWithCodes', () => {
  test('finds the product with exactly the same codes in any order', async () => {
    const { database, addProduct } = await setup()
    addProduct(['2001'], 'Sabonete lavanda')
    const pair = addProduct(['2001', '2002'], 'Sabonete lavanda e erva-doce')
    addProduct(['2001', '2002', '2003'], 'Sabonete todas')

    expect(findProductWithCodes(database, ['2002', ' 2001'])).toEqual(pair)
    expect(findProductWithCodes(database, ['2002'])).toBe(undefined)
    expect(findProductWithCodes(database, [])).toBe(undefined)
  })
})

describe('saveProduct', () => {
  test('saves a new catalog product with a copy of its image', async () => {
    const { database, catalog, photos, readPhoto } = await setup()

    const saved = await saveProduct(
      database,
      { codes: [EAN], ...catalogProduct, photo: { kind: 'ean', ean: EAN } },
      { catalog, photos }
    )

    expect(saved).toMatchObject({ codes: [EAN], photo: `${EAN}.png` })
    expect(await readPhoto(`${EAN}.png`)).toBe('catalog image')
    expect(findProductById(database, saved.id)).toEqual(saved)
  })

  test('saves a product without photo when the catalog has no image', async () => {
    const { database, catalog, photos } = await setup()

    const saved = await saveProduct(
      database,
      {
        codes: ['7891000053508'],
        ...catalogProduct,
        photo: { kind: 'ean', ean: '7891000053508' }
      },
      { catalog, photos }
    )

    expect(saved.photo).toBe(null)
  })

  test('updates a product by id and replaces its codes', async () => {
    const { database, catalog, photos, addProduct } = await setup()
    const product = addProduct(['2001'], 'Picanha')

    await saveProduct(
      database,
      {
        id: product.id,
        codes: ['2002', ' 2003', '2002'],
        name: 'Picanha bovina',
        brand: null,
        unit: 'Kg'
      },
      { catalog, photos }
    )

    expect(findProductById(database, product.id)).toEqual({
      ...product,
      codes: ['2002', '2003'],
      name: 'Picanha bovina',
      unit: 'Kg'
    })
    expect(database.select().from(products).all()).toHaveLength(1)
  })

  test('takes a code another product has, but never the same codes', async () => {
    const { database, catalog, photos, addProduct } = await setup()
    const single = addProduct(['2001'], 'Sabonete lavanda')
    const details = { name: 'Sabonete', brand: null, unit: null }

    const group = await saveProduct(
      database,
      { codes: ['2001', '2002'], ...details },
      { catalog, photos }
    )
    expect(group.codes).toEqual(['2001', '2002'])

    await expect(
      saveProduct(
        database,
        { codes: ['2002', '2001'], ...details },
        { catalog, photos }
      )
    ).rejects.toThrow(DuplicateCodesError)
    await expect(
      saveProduct(
        database,
        { id: group.id, codes: ['2001'], ...details },
        { catalog, photos }
      )
    ).rejects.toThrow(DuplicateCodesError)
    expect(findProductById(database, single.id)).toEqual(single)
    expect(findProductById(database, group.id)).toEqual(group)
  })

  test('rejects a product without codes or with a code that could leave the photos folder', async () => {
    const { database, catalog, photos } = await setup()
    const details = { name: 'Picanha', brand: null, unit: null }

    await expect(
      saveProduct(database, { codes: [' '], ...details }, { catalog, photos })
    ).rejects.toThrow()
    await expect(
      saveProduct(
        database,
        { codes: ['../logo'], ...details },
        { catalog, photos }
      )
    ).rejects.toThrow()
  })

  test('refuses an id that is not saved', async () => {
    const { database, catalog, photos } = await setup()

    await expect(
      saveProduct(
        database,
        {
          id: randomUUID(),
          codes: ['2001'],
          name: 'Picanha',
          brand: null,
          unit: null
        },
        { catalog, photos }
      )
    ).rejects.toThrow(MissingProductError)
  })

  test('renames the photo when the product becomes a group and back', async () => {
    const { database, catalog, photos, addProduct, readPhoto } = await setup()
    const product = addProduct(['2001'], 'Sabonete', { photo: '2001.png' })
    await writeFile(path.join(photos, '2001.png'), 'photo')
    const details = { name: 'Sabonete', brand: null, unit: null }

    const group = await saveProduct(
      database,
      { id: product.id, codes: ['2001', '2002'], ...details },
      { catalog, photos }
    )
    expect(group.photo).toBe(`${product.id}.png`)
    expect(await readPhoto(`${product.id}.png`)).toBe('photo')
    expect(await exists(path.join(photos, '2001.png'))).toBe(false)

    const single = await saveProduct(
      database,
      { id: product.id, codes: ['2002'], ...details },
      { catalog, photos }
    )
    expect(single.photo).toBe('2002.png')
    expect(await readPhoto('2002.png')).toBe('photo')
  })

  test('removes the old file when a new photo gets another name', async () => {
    const { database, catalog, photos, addProduct } = await setup()
    const product = addProduct(['2001'], 'Alcatra', { photo: '2001.png' })
    await writeFile(path.join(photos, '2001.png'), 'photo')

    const saved = await saveProduct(
      database,
      {
        id: product.id,
        codes: ['2002'],
        name: 'Alcatra',
        brand: null,
        unit: null,
        photo: { kind: 'ean', ean: EAN }
      },
      { catalog, photos }
    )

    expect(saved.photo).toBe('2002.png')
    expect(await exists(path.join(photos, '2001.png'))).toBe(false)
  })

  test('drops a photo missing from the disk instead of keeping a broken one', async () => {
    const { database, catalog, photos, addProduct } = await setup()
    const product = addProduct(['2001'], 'Alcatra', { photo: '2001.png' })

    const saved = await saveProduct(
      database,
      {
        id: product.id,
        codes: ['2002'],
        name: 'Alcatra',
        brand: null,
        unit: null
      },
      { catalog, photos }
    )

    expect(saved.photo).toBe(null)
  })
})

describe('listProducts', () => {
  test('searches the name ignoring case and any code by any part', async () => {
    const { database, addProduct } = await setup()
    addProduct(['1001'], 'picanha bovina')
    addProduct(['2002', '4010'], 'Alcatra')
    addProduct(['3010'], 'Fraldinha')

    const names = (query: string) =>
      listProducts(database, { query }).products.map(({ name }) => name)

    expect(names('PICANHA')).toEqual(['picanha bovina'])
    expect(names(' 01 ')).toEqual(['Alcatra', 'Fraldinha', 'picanha bovina'])
    expect(names('4010')).toEqual(['Alcatra'])
    expect(names('')).toEqual(['Alcatra', 'Fraldinha', 'picanha bovina'])
  })

  test('returns each product with its codes', async () => {
    const { database, addProduct } = await setup()
    const product = addProduct(['2002', '2001'], 'Sabonete')

    expect(listProducts(database).products).toEqual([product])
  })

  test('searches and sorts the name ignoring accents and cedilla', async () => {
    const { database, addProduct } = await setup()
    addProduct(['1'], 'Pão Francês')
    addProduct(['2'], 'pão de queijo')
    addProduct(['3'], 'Açúcar Cristal')
    addProduct(['4'], 'Ágata Azeite')
    addProduct(['5'], 'Batata')

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
    const { database, addProduct } = await setup()
    addProduct(['1'], 'Desconto 50%')
    addProduct(['2'], 'Arroz 5 kg')

    expect(
      listProducts(database, { query: '50%' }).products.map(({ name }) => name)
    ).toEqual(['Desconto 50%'])
    expect(listProducts(database, { query: '_' }).total).toBe(0)
  })

  test('pages the products and keeps the page within range', async () => {
    const { database, addProduct } = await setup()
    for (let index = 0; index <= PRODUCTS_PAGE_SIZE; index++) {
      addProduct([String(index)], `Produto ${String(index).padStart(3, '0')}`)
    }

    const first = listProducts(database)
    expect(first).toMatchObject({ total: 51, page: 1, pageCount: 2 })
    expect(first.products).toHaveLength(PRODUCTS_PAGE_SIZE)

    const last = listProducts(database, { page: 2 })
    expect(last.products.map(({ codes }) => codes)).toEqual([['50']])
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
  test('matches every word in the name, brand, unit or codes ignoring accents', async () => {
    const { database, addProduct } = await setup()
    addProduct(['7891', '7893'], 'Sabonete Erva-Doce', {
      brand: 'Albany',
      unit: '85 g'
    })
    addProduct(['7892'], 'Sabonete Aveia', { brand: 'Lux', unit: '85 g' })
    addProduct(['ab-1'], 'Pão Francês')

    const names = (query: string) =>
      searchProducts(database, query).map(({ name }) => name)

    expect(names('sabonete')).toEqual(['Sabonete Aveia', 'Sabonete Erva-Doce'])
    expect(names('SABONETE  albany')).toEqual(['Sabonete Erva-Doce'])
    expect(names('85 G')).toEqual(['Sabonete Aveia', 'Sabonete Erva-Doce'])
    expect(names('7893')).toEqual(['Sabonete Erva-Doce'])
    expect(names('AB-1')).toEqual(['Pão Francês'])
    expect(names('pao frances')).toEqual(['Pão Francês'])
    expect(names('pao albany')).toEqual([])
    expect(names('  ')).toEqual([])
  })

  test('takes % and _ literally and stops at the limit', async () => {
    const { database, addProduct } = await setup()
    for (let index = 0; index < 3; index++) {
      addProduct([String(index)], `Produto ${index}`)
    }

    expect(searchProducts(database, '%')).toEqual([])
    expect(searchProducts(database, '_')).toEqual([])
    expect(
      searchProducts(database, 'produto', { limit: 2 }).map(({ name }) => name)
    ).toEqual(['Produto 0', 'Produto 1'])
  })
})

const addOffer = (
  database: Awaited<ReturnType<typeof setup>>['database'],
  name: string,
  productIds: string[]
) => {
  const offer = database
    .insert(offers)
    .values({ name, highlightTitle: '', highlightMessage: '' })
    .returning()
    .get()
  for (const [position, productId] of productIds.entries()) {
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
      .values({ pageId: page.id, position: 0, productId, priceInCents: 100 })
      .run()
  }
}

describe('deleteProduct', () => {
  test('deletes the product, its codes and its photo', async () => {
    const { database, photos, addProduct } = await setup()
    const product = addProduct([EAN, '2001'], 'Leite', {
      photo: `${EAN}.png`
    })
    const other = addProduct(['2001'], 'Picanha')
    await writeFile(path.join(photos, `${EAN}.png`), 'image')

    expect(await deleteProduct(database, product.id, { photos })).toEqual({
      status: 'deleted'
    })
    expect(listProducts(database).products).toEqual([other])
    expect(database.select().from(productCodes).all()).toEqual([
      { productId: other.id, code: '2001' }
    ])
    expect(await exists(path.join(photos, `${EAN}.png`))).toBe(false)
  })

  test('deletes a product without a photo', async () => {
    const { database, photos, addProduct } = await setup()
    const product = addProduct(['1234'], 'Picanha')

    expect(await deleteProduct(database, product.id, { photos })).toEqual({
      status: 'deleted'
    })
    expect(database.select().from(products).all()).toEqual([])
  })

  test('refuses a product used in offers and names each offer once', async () => {
    const { database, photos, addProduct, readPhoto } = await setup()
    const product = addProduct([EAN], 'Leite', { photo: `${EAN}.png` })
    const other = addProduct(['1234'], 'Picanha')
    await writeFile(path.join(photos, `${EAN}.png`), 'image')
    addOffer(database, 'Semana', [product.id, product.id])
    addOffer(database, 'Açougue', [other.id])
    addOffer(database, 'Fim de semana', [other.id, product.id])

    expect(await deleteProduct(database, product.id, { photos })).toEqual({
      status: 'in-use',
      offers: ['Fim de semana', 'Semana']
    })
    expect(database.select().from(products).all()).toHaveLength(2)
    expect(await readPhoto(`${EAN}.png`)).toBe('image')
  })

  test('rejects an id that is not a UUID', async () => {
    const { database, photos } = await setup()

    await expect(
      deleteProduct(database, '../logo', { photos })
    ).rejects.toThrow()
  })
})

describe('renameOutdatedPhotos', () => {
  test('moves the photo of a group saved before #55 to its id', async () => {
    const { database, photos, addProduct, readPhoto } = await setup()
    const group = addProduct(['2001', '2002'], 'Sabonete', {
      photo: '2001.png'
    })
    const single = addProduct(['3001'], 'Picanha', { photo: '3001.png' })
    const missing = addProduct(['4001', '4002'], 'Alcatra', {
      photo: '4001.png'
    })
    await writeFile(path.join(photos, '2001.png'), 'group')
    await writeFile(path.join(photos, '3001.png'), 'single')

    await renameOutdatedPhotos(database, { photos })

    expect(findProductById(database, group.id)?.photo).toBe(`${group.id}.png`)
    expect(await readPhoto(`${group.id}.png`)).toBe('group')
    expect(await exists(path.join(photos, '2001.png'))).toBe(false)
    expect(findProductById(database, single.id)).toEqual(single)
    expect(findProductById(database, missing.id)).toEqual(missing)
  })
})
