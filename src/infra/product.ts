import { copyFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

import { asc, count, eq, or, type SQL, sql } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'

import {
  type FoundProduct,
  getCodeType,
  getPhotoFileName,
  isValidCode,
  normalizeCode,
  normalizeSearchText,
  type Product,
  type ProductPage,
  PRODUCTS_PAGE_SIZE
} from '@/domain/product'
import { eanDirectory } from '@/infra/catalog/directory'
import {
  getCatalogImageFile,
  readCatalogProduct
} from '@/infra/catalog/product'
import {
  offerPageItems,
  offerPages,
  offers,
  products
} from '@/infra/database/schema'
import { searchText } from '@/infra/database/search-text'
import { photosDirectory } from '@/infra/photos-directory'

type Database = BetterSQLite3Database

type ProductDirectories = {
  catalog?: string
  photos?: string
}

export const findProductByCode = async (
  database: Database,
  rawCode: string,
  { catalog = eanDirectory }: ProductDirectories = {}
): Promise<FoundProduct | undefined> => {
  const code = normalizeCode(rawCode)
  if (code === '') return undefined

  const saved = database
    .select()
    .from(products)
    .where(eq(products.code, code))
    .get()
  if (saved) return { product: saved, source: 'instance' }

  // Internal codes differ from store to store, so the catalog only knows products by EAN
  if (getCodeType(code) !== 'ean') return undefined

  const catalogProduct = await readCatalogProduct(code, catalog)
  if (!catalogProduct) return undefined

  return {
    product: { code, codeType: 'ean', ...catalogProduct, photo: null },
    source: 'catalog'
  }
}

// The photo is copied rather than referenced, so a later catalog update never changes a product
// the store already uses
const copyCatalogPhoto = async (
  code: string,
  catalog: string,
  photos: string
) => {
  const photo = getPhotoFileName(code)
  await mkdir(photos, { recursive: true })
  try {
    await copyFile(getCatalogImageFile(code, catalog), path.join(photos, photo))
    return photo
  } catch {
    return null
  }
}

export const saveProduct = async (
  database: Database,
  { product, source }: FoundProduct,
  { catalog = eanDirectory, photos = photosDirectory }: ProductDirectories = {}
): Promise<Product> => {
  const code = normalizeCode(product.code)
  const saved: Product = {
    ...product,
    code,
    codeType: getCodeType(code),
    photo:
      source === 'catalog'
        ? await copyCatalogPhoto(code, catalog, photos)
        : product.photo
  }

  database
    .insert(products)
    .values(saved)
    .onConflictDoUpdate({ target: products.code, set: saved })
    .run()

  return saved
}

const escapeLike = (text: string) => text.replaceAll(/[\\%_]/g, String.raw`\$&`)

const contains = (column: SQL | SQLiteColumn, text: string): SQL =>
  sql`${column} LIKE ${`%${escapeLike(text)}%`} ESCAPE '\\'`

export const listProducts = (
  database: Database,
  { query = '', page = 1 }: { query?: string; page?: number } = {}
): ProductPage => {
  const name = query.trim()
  const where =
    name === ''
      ? undefined
      : or(
          contains(searchText(products.name), normalizeSearchText(name)),
          contains(products.code, normalizeCode(query))
        )

  const total =
    database.select({ total: count() }).from(products).where(where).get()
      ?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE))
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount)

  const rows = database
    .select()
    .from(products)
    .where(where)
    .orderBy(searchText(products.name), products.code)
    .limit(PRODUCTS_PAGE_SIZE)
    .offset((current - 1) * PRODUCTS_PAGE_SIZE)
    .all()

  return { products: rows, total, page: current, pageCount }
}

export const findOffersUsingProduct = (database: Database, code: string) =>
  database
    .selectDistinct({ id: offers.id, name: offers.name })
    .from(offerPageItems)
    .innerJoin(offerPages, eq(offerPages.id, offerPageItems.pageId))
    .innerJoin(offers, eq(offers.id, offerPages.offerId))
    .where(eq(offerPageItems.productCode, normalizeCode(code)))
    .orderBy(asc(offers.name), asc(offers.id))
    .all()
    .map(({ name }) => name)

export type DeleteProductResult =
  { status: 'deleted' } | { status: 'in-use'; offers: string[] }

// Offers are left untouched: whoever deletes the product takes it out of them first (#28)
export const deleteProduct = async (
  database: Database,
  rawCode: string,
  { photos = photosDirectory }: ProductDirectories = {}
): Promise<DeleteProductResult> => {
  const code = normalizeCode(rawCode)
  if (!isValidCode(code)) throw new Error(`Invalid product code: ${code}`)

  const offerNames = findOffersUsingProduct(database, code)
  if (offerNames.length > 0) return { status: 'in-use', offers: offerNames }

  database.delete(products).where(eq(products.code, code)).run()
  await rm(path.join(photos, getPhotoFileName(code)), { force: true })
  return { status: 'deleted' }
}
