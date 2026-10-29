// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import sharp from 'sharp'
import { expect, onTestFinished, test } from 'vitest'

import { checkCatalogImage } from '@/domain/catalog'
import type { Product } from '@/domain/product'
import { readCatalogImage } from '@/infra/catalog/image'
import { migrationsFolder } from '@/infra/database/file'
import { productCodes, products } from '@/infra/database/schema'
import { registerSearchText } from '@/infra/database/search-text'

import { buildCatalogExport } from './export'

const EAN = '7891000100103'
const CATALOG_EAN = '7891000053508'
const CATALOG_CODE = '7891000053515'

const createImage = async ({
  side,
  background
}: {
  side: number
  background: 'transparent' | 'white'
}) => {
  const product = await sharp({
    create: {
      width: side / 2,
      height: side / 2,
      channels: 4,
      background: '#c0392b'
    }
  })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: side,
      height: side,
      channels: 4,
      background:
        background === 'white' ? '#ffffff' : { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: product, left: side / 4, top: side / 4 }])
    .png()
    .toBuffer()
}

const setup = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'catalog-export-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))

  const photos = path.join(directory, 'photos')
  const ean = path.join(directory, 'ean')
  const noEan = path.join(directory, 'no-ean')
  await Promise.all([photos, ean, noEan].map((folder) => mkdir(folder)))

  const sqlite = new Database(':memory:')
  registerSearchText(sqlite)
  const database = drizzle({ client: sqlite })
  migrate(database, { migrationsFolder })

  const addProduct = async (
    { codes, ...product }: Omit<Product, 'id' | 'photo'>,
    photo?: Buffer
  ) => {
    const id = randomUUID()
    const fileName = photo ? `${id}.png` : null
    if (photo && fileName) await writeFile(path.join(photos, fileName), photo)
    database
      .insert(products)
      .values({ ...product, id, photo: fileName })
      .run()
    database
      .insert(productCodes)
      .values(codes.map((code) => ({ productId: id, code })))
      .run()
  }

  return { database, photos, ean, noEan, addProduct }
}

const read = (file: Uint8Array | undefined) => new TextDecoder().decode(file)

test('exports the products that fit the catalog in its folders', async () => {
  const { database, addProduct, ...directories } = await setup()
  const photo = await createImage({ side: 1600, background: 'transparent' })
  await addProduct(
    {
      codes: [EAN],
      name: 'Leite Condensado',
      brand: 'Moça',
      unit: '395 g'
    },
    photo
  )
  await addProduct(
    {
      codes: ['2001'],
      name: 'Pão Francês',
      brand: null,
      unit: null
    },
    photo
  )

  const files = await buildCatalogExport(database, directories)

  expect(Object.keys(files).toSorted((a, b) => a.localeCompare(b))).toEqual([
    `ean/${EAN}.json`,
    `ean/${EAN}.png`,
    'no-ean/pao-frances.png',
    'relatorio.txt'
  ])
  expect(JSON.parse(read(files[`ean/${EAN}.json`]))).toEqual({
    name: 'Leite Condensado',
    brand: 'Moça',
    unit: '395 g'
  })
  const image = await readCatalogImage(Buffer.from(files[`ean/${EAN}.png`]))
  expect(checkCatalogImage(image)).toEqual([])
})

test('exports a group with its other EANs, after the single products', async () => {
  const { database, addProduct, ...directories } = await setup()
  const photo = await createImage({ side: 1600, background: 'transparent' })
  const details = { brand: 'Albany', unit: '85 g' }
  await addProduct(
    {
      codes: [EAN, '7891000100110', '7891000100127', '2001'],
      name: 'Sabonete',
      ...details
    },
    photo
  )
  await addProduct(
    {
      codes: ['7891000100127', '7891000100134'],
      name: 'Amaciante',
      ...details
    },
    photo
  )
  await addProduct(
    { codes: ['7891000100134'], name: 'Sabonete Erva-Doce', ...details },
    photo
  )

  const files = await buildCatalogExport(database, directories)

  expect(Object.keys(files).toSorted((a, b) => a.localeCompare(b))).toEqual([
    `ean/${EAN}.json`,
    `ean/${EAN}.png`,
    'ean/7891000100134.json',
    'ean/7891000100134.png',
    'relatorio.txt'
  ])
  expect(JSON.parse(read(files[`ean/${EAN}.json`]))).toEqual({
    name: 'Sabonete',
    ...details,
    codes: ['7891000100110', '7891000100127']
  })
  expect(read(files['relatorio.txt'])).toContain(
    '7891000100127, 7891000100134 · Amaciante: O EAN 7891000100134 já foi exportado em outro produto'
  )
})

test('reports the products left out and why', async () => {
  const { database, addProduct, ...directories } = await setup()
  const transparent = await createImage({
    side: 1600,
    background: 'transparent'
  })
  const catalogImage = await createImage({
    side: 700,
    background: 'transparent'
  })
  await writeFile(path.join(directories.ean, `${CATALOG_EAN}.json`), '{}')
  await writeFile(
    path.join(directories.ean, '7891000053522.json'),
    JSON.stringify({
      name: 'Sabonete',
      brand: 'Albany',
      unit: '85 g',
      codes: [CATALOG_CODE]
    })
  )
  await writeFile(path.join(directories.noEan, 'picanha.png'), catalogImage)

  await addProduct(
    {
      codes: ['1'],
      name: 'Alface',
      brand: null,
      unit: null
    },
    await createImage({ side: 1600, background: 'white' })
  )
  await addProduct(
    {
      codes: ['2'],
      name: 'Banana',
      brand: null,
      unit: null
    },
    await createImage({ side: 400, background: 'transparent' })
  )
  await addProduct(
    {
      codes: ['3'],
      name: 'Coxão Mole',
      brand: null,
      unit: null
    },
    catalogImage
  )
  await addProduct(
    {
      codes: ['4'],
      name: 'Laranja',
      brand: null,
      unit: null
    },
    transparent
  )
  await addProduct(
    {
      codes: ['5'],
      name: 'laranja',
      brand: null,
      unit: null
    },
    transparent
  )
  await addProduct(
    {
      codes: [EAN, CATALOG_CODE],
      name: 'Sabonete',
      brand: 'Albany',
      unit: '85 g'
    },
    transparent
  )
  await addProduct({
    codes: ['6'],
    name: 'Pepino',
    brand: null,
    unit: null
  })
  await addProduct(
    {
      codes: [CATALOG_EAN],
      name: 'Café',
      brand: 'Pilão',
      unit: '500 g'
    },
    transparent
  )

  const files = await buildCatalogExport(database, directories)

  expect(Object.keys(files).toSorted((a, b) => a.localeCompare(b))).toEqual([
    'no-ean/laranja.png',
    'relatorio.txt'
  ])
  const [pending, inCatalog] = read(files['relatorio.txt']).split(
    'Produtos que já estão no catálogo:',
    2
  )
  expect(pending).toContain(
    '1 · Alface: O fundo da imagem precisa ser transparente'
  )
  expect(pending).toMatch(/2 · Banana: O lado da imagem precisa ter/)
  expect(inCatalog).toContain('3 · Coxão Mole: A foto é uma imagem do catálogo')
  expect(pending).toContain(
    '5 · laranja: Outro produto já foi exportado como laranja.png'
  )
  expect(pending).toContain('6 · Pepino: Sem foto')
  expect(inCatalog).toContain(
    `${CATALOG_CODE}, ${EAN} · Sabonete: O EAN ${CATALOG_CODE} já está no catálogo`
  )
  expect(inCatalog).toContain(
    `${CATALOG_EAN} · Café: O EAN ${CATALOG_EAN} já está no catálogo`
  )
})
