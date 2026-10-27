import { randomUUID } from 'node:crypto'

import {
  and,
  asc,
  count,
  eq,
  exists,
  inArray,
  or,
  type SQL,
  sql
} from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'

import {
  type CatalogMatch,
  getCodeType,
  getPhotoFileName,
  isSameCodeSet,
  isValidCode,
  isValidProductId,
  normalizeCode,
  normalizeCodes,
  normalizeSearchText,
  type Product,
  PRODUCT_SUGGESTION_LIMIT,
  type ProductDetails,
  type ProductPage,
  PRODUCTS_PAGE_SIZE
} from '@/domain/product'
import { eanDirectory, noEanDirectory } from '@/infra/catalog/directory'
import { readCatalogProduct } from '@/infra/catalog/product'
import {
  offerPageItems,
  offerPages,
  offers,
  productCodes,
  products
} from '@/infra/database/schema'
import { searchText } from '@/infra/database/search-text'
import {
  copyEanImage,
  copyNoEanImage,
  removePhoto,
  renamePhoto,
  savePhoto
} from '@/infra/photo'
import { photosDirectory } from '@/infra/photos-directory'

type Database = BetterSQLite3Database

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

type ProductDirectories = {
  catalog?: string
  photos?: string
  noEan?: string
}

type ProductRow = typeof products.$inferSelect

// Breaks ties between products with the same name the same way on every query
export const firstProductCode = sql`(SELECT min(${productCodes.code}) FROM ${productCodes} WHERE ${productCodes.productId} = ${products.id})`

export const attachCodes = (
  database: Database | Transaction,
  rows: ProductRow[]
): Product[] => {
  if (rows.length === 0) return []

  const ids = rows.map(({ id }) => id)
  const codeRows = database
    .select()
    .from(productCodes)
    .where(inArray(productCodes.productId, ids))
    .orderBy(productCodes.code)
    .all()
  const codes = Map.groupBy(codeRows, ({ productId }) => productId)
  return rows.map((row) => ({
    ...row,
    codes: codes.get(row.id)?.map(({ code }) => code) ?? []
  }))
}

export const findProductById = (
  database: Database | Transaction,
  id: string
): Product | undefined => {
  const row = database.select().from(products).where(eq(products.id, id)).get()
  return row && attachCodes(database, [row])[0]
}

const findInstanceProducts = (
  database: Database | Transaction,
  code: string
): Product[] => {
  const hasCode = and(
    eq(productCodes.productId, products.id),
    eq(productCodes.code, code)
  )
  const rows = database
    .select()
    .from(products)
    .where(exists(database.select().from(productCodes).where(hasCode)))
    .orderBy(searchText(products.name), firstProductCode)
    .all()

  // A single product comes before the groups that also have its code, smaller groups first
  return attachCodes(database, rows).toSorted(
    (a, b) => a.codes.length - b.codes.length
  )
}

export const findProductWithCodes = (
  database: Database | Transaction,
  codes: string[]
) => {
  const [first] = normalizeCodes(codes)
  if (first === undefined) return
  return findInstanceProducts(database, first).find((product) =>
    isSameCodeSet(product.codes, codes)
  )
}

export type CodeLookup =
  | { source: 'instance'; products: Product[] }
  | { source: 'catalog'; product: CatalogMatch }

export const findProductsByCode = async (
  database: Database,
  rawCode: string,
  { catalog = eanDirectory }: ProductDirectories = {}
): Promise<CodeLookup | undefined> => {
  const code = normalizeCode(rawCode)
  if (code === '') return undefined

  const saved = findInstanceProducts(database, code)
  if (saved.length > 0) return { source: 'instance', products: saved }

  // Internal codes differ from store to store, so the catalog only knows products by EAN
  if (getCodeType(code) !== 'ean') return undefined

  const catalogProduct = await readCatalogProduct(code, catalog)
  return (
    catalogProduct && {
      source: 'catalog',
      product: { code, ...catalogProduct }
    }
  )
}

export class DuplicateCodesError extends Error {
  constructor(readonly product: Product) {
    super(`Codes already used by product ${product.id}`)
  }
}

export class MissingProductError extends Error {
  constructor(readonly id: string) {
    super(`Product not found: ${id}`)
  }
}

export class PhotoSourceError extends Error {}

export type PhotoSource =
  | { kind: 'upload'; image: Buffer }
  | { kind: 'no-ean'; name: string }
  | { kind: 'ean'; ean: string }

export type ProductInput = ProductDetails & {
  // Left out for a new product
  id?: string
  codes: string[]
  // Left out, the current photo stays, renamed if the codes change its file name
  photo?: PhotoSource
}

const writePhotoSource = async (
  source: PhotoSource,
  fileName: string,
  {
    catalog = eanDirectory,
    photos = photosDirectory,
    noEan = noEanDirectory
  }: ProductDirectories
) => {
  try {
    switch (source.kind) {
      case 'upload': {
        await savePhoto(fileName, source.image, { photos })
        return fileName
      }
      case 'no-ean': {
        await copyNoEanImage(source.name, fileName, { photos, noEan })
        return fileName
      }
      case 'ean': {
        const copied = await copyEanImage(source.ean, fileName, {
          photos,
          ean: catalog
        })
        return copied ? fileName : null
      }
    }
  } catch (error) {
    throw new PhotoSourceError('Could not write the product photo', {
      cause: error
    })
  }
}

const checkDuplicateCodes = (
  database: Database | Transaction,
  id: string,
  codes: string[]
) => {
  const duplicate = findProductWithCodes(database, codes)
  if (duplicate && duplicate.id !== id) throw new DuplicateCodesError(duplicate)
}

export const saveProduct = async (
  database: Database,
  input: ProductInput,
  directories: ProductDirectories = {}
): Promise<Product> => {
  const codes = normalizeCodes(input.codes)
  if (codes.length === 0) throw new Error('A product needs at least one code')
  const invalid = codes.find((code) => !isValidCode(code))
  if (invalid !== undefined) throw new Error(`Invalid product code: ${invalid}`)

  const current =
    input.id === undefined ? undefined : findProductById(database, input.id)
  if (!current && input.id !== undefined)
    throw new MissingProductError(input.id)

  const id = current?.id ?? randomUUID()
  // Checked before any photo is written, so a refused save leaves nothing behind
  checkDuplicateCodes(database, id, codes)

  const { photos = photosDirectory } = directories
  const fileName = getPhotoFileName({ id, codes })
  let photo = current?.photo ?? null
  if (input.photo) {
    photo = await writePhotoSource(input.photo, fileName, directories)
  } else if (photo !== null && photo !== fileName) {
    try {
      await renamePhoto(photo, fileName, { photos })
      photo = fileName
    } catch {
      // The file is already gone, so the product is left without a photo instead of a broken one
      photo = null
    }
  }

  const saved: Product = {
    id,
    codes,
    name: input.name,
    brand: input.brand,
    unit: input.unit,
    photo
  }

  database.transaction((transaction) => {
    checkDuplicateCodes(transaction, id, codes)

    const row = {
      id,
      name: saved.name,
      brand: saved.brand,
      unit: saved.unit,
      photo
    }
    transaction
      .insert(products)
      .values(row)
      .onConflictDoUpdate({ target: products.id, set: row })
      .run()
    transaction.delete(productCodes).where(eq(productCodes.productId, id)).run()
    transaction
      .insert(productCodes)
      .values(codes.map((code) => ({ productId: id, code })))
      .run()
  })

  // A new photo under a new file name leaves the old file behind
  if (current?.photo && input.photo && current.photo !== fileName) {
    await removePhoto(current.photo, { photos })
  }

  return saved
}

const escapeLike = (text: string) => text.replaceAll(/[\\%_]/g, String.raw`\$&`)

const contains = (column: SQL | SQLiteColumn, text: string): SQL =>
  sql`${column} LIKE ${`%${escapeLike(text)}%`} ESCAPE '\\'`

const productCodeList = sql`(SELECT group_concat(${productCodes.code}, ' ') FROM ${productCodes} WHERE ${productCodes.productId} = ${products.id})`

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
          contains(productCodeList, normalizeCode(query))
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
    .orderBy(searchText(products.name), firstProductCode)
    .limit(PRODUCTS_PAGE_SIZE)
    .offset((current - 1) * PRODUCTS_PAGE_SIZE)
    .all()

  return {
    products: attachCodes(database, rows),
    total,
    page: current,
    pageCount
  }
}

export const searchProducts = (
  database: Database,
  query: string,
  { limit = PRODUCT_SUGGESTION_LIMIT }: { limit?: number } = {}
): Product[] => {
  const words = normalizeSearchText(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  // Joining the fields lets a query mix them, e.g. a name and a brand ("sabonete albany")
  const fields = sql`search_text(${products.name} || ' ' || coalesce(${products.brand}, '') || ' ' || coalesce(${products.unit}, '') || ' ' || coalesce(${productCodeList}, ''))`

  const rows = database
    .select()
    .from(products)
    .where(and(...words.map((word) => contains(fields, word))))
    .orderBy(searchText(products.name), firstProductCode)
    .limit(limit)
    .all()
  return attachCodes(database, rows)
}

export const findOffersUsingProduct = (database: Database, id: string) =>
  database
    .selectDistinct({ id: offers.id, name: offers.name })
    .from(offerPageItems)
    .innerJoin(offerPages, eq(offerPages.id, offerPageItems.pageId))
    .innerJoin(offers, eq(offers.id, offerPages.offerId))
    .where(eq(offerPageItems.productId, id))
    .orderBy(asc(offers.name), asc(offers.id))
    .all()
    .map(({ name }) => name)

export type DeleteProductResult =
  { status: 'deleted' } | { status: 'in-use'; offers: string[] }

// Offers are left untouched: whoever deletes the product takes it out of them first (#28)
export const deleteProduct = async (
  database: Database,
  id: string,
  { photos = photosDirectory }: ProductDirectories = {}
): Promise<DeleteProductResult> => {
  if (!isValidProductId(id)) throw new Error(`Invalid product id: ${id}`)

  const offerNames = findOffersUsingProduct(database, id)
  if (offerNames.length > 0) return { status: 'in-use', offers: offerNames }

  const product = findProductById(database, id)
  database.delete(products).where(eq(products.id, id)).run()
  if (product?.photo) await removePhoto(product.photo, { photos })
  return { status: 'deleted' }
}

// Products saved before #55 keep the photo under their old main code. A group must move to its id,
// or a product later saved with only that code would write over the group's photo
export const renameOutdatedPhotos = async (
  database: Database,
  { photos = photosDirectory }: ProductDirectories = {}
) => {
  const rows = database
    .select()
    .from(products)
    .where(sql`${products.photo} IS NOT NULL`)
    .all()
  const outdated = attachCodes(database, rows).flatMap(
    ({ photo, ...product }) =>
      photo !== null && photo !== getPhotoFileName(product)
        ? [{ ...product, photo }]
        : []
  )

  // Groups move to their ids first, freeing the code names a single product may need
  const groupsFirst = outdated.toSorted(
    (a, b) => b.codes.length - a.codes.length
  )
  for (const product of groupsFirst) {
    const fileName = getPhotoFileName(product)
    try {
      await renamePhoto(product.photo, fileName, { photos })
    } catch {
      // A photo missing from the disk is served as no photo either way
      continue
    }
    database
      .update(products)
      .set({ photo: fileName })
      .where(eq(products.id, product.id))
      .run()
  }
}
