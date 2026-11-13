import { and, eq, exists, inArray, type SQL, sql } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'

import { offerPageItems, productCodes, products } from '@/infra/database/schema'
import { searchText } from '@/infra/database/search-text'
import type { Product } from '@/models/product/product'

type Database = BetterSQLite3Database

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

type Connection = Database | Transaction

type ProductRow = typeof products.$inferSelect

// Breaks ties between products with the same description the same way on every query
const firstProductCode = sql`(SELECT min(${productCodes.code}) FROM ${productCodes} WHERE ${productCodes.productId} = ${products.id})`

const attachCodes = (database: Connection, rows: ProductRow[]): Product[] => {
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

const findById = (database: Connection, id: string): Product | undefined => {
  const row = database.select().from(products).where(eq(products.id, id)).get()
  return row && attachCodes(database, [row])[0]
}

const listByIds = (database: Connection, ids: string[]): Product[] =>
  attachCodes(
    database,
    database.select().from(products).where(inArray(products.id, ids)).all()
  )

const listByCode = (database: Connection, code: string): Product[] => {
  const hasCode = and(
    eq(productCodes.productId, products.id),
    eq(productCodes.code, code)
  )
  const withCode = database.select().from(productCodes).where(hasCode)
  return attachCodes(
    database,
    database
      .select()
      .from(products)
      .where(exists(withCode))
      .orderBy(searchText(products.description), firstProductCode)
      .all()
  )
}

// By description, then by the first code
const listAll = (database: Connection): Product[] =>
  attachCodes(
    database,
    database
      .select()
      .from(products)
      .orderBy(searchText(products.description), firstProductCode)
      .all()
  )

const listWithPhoto = (database: Connection): Product[] =>
  attachCodes(
    database,
    database
      .select()
      .from(products)
      .where(sql`${products.photo} IS NOT NULL`)
      .all()
  )

const listCodes = (database: Connection): Set<string> =>
  new Set(
    database
      .selectDistinct({ code: productCodes.code })
      .from(productCodes)
      .all()
      .map(({ code }) => code)
  )

const escapeLike = (text: string) => text.replaceAll(/[\\%_]/g, String.raw`\$&`)

const contains = (column: SQL | SQLiteColumn, text: string): SQL =>
  sql`${column} LIKE ${`%${escapeLike(text)}%`} ESCAPE '\\'`

const productCodeList = sql`(SELECT group_concat(${productCodes.code}, ' ') FROM ${productCodes} WHERE ${productCodes.productId} = ${products.id})`

// Joining the fields lets a query mix them, e.g. a description and a unit ("sabonete 85")
const productSearchFields = sql`search_text(${products.description} || ' ' || coalesce(${products.unit}, '') || ' ' || coalesce(${productCodeList}, ''))`

// Every word in the description, unit or codes, ignoring case and accents
const matchesWords = (words: string[]) =>
  and(...words.map((word) => contains(productSearchFields, word)))

// Unordered: the list sorts it with the catalog's products
const listMatching = (database: Connection, words: string[]): Product[] =>
  attachCodes(
    database,
    database
      .select()
      .from(products)
      .where(words.length === 0 ? undefined : matchesWords(words))
      .all()
  )

const searchMatching = (
  database: Connection,
  words: string[],
  limit: number
): Product[] =>
  attachCodes(
    database,
    database
      .select()
      .from(products)
      .where(matchesWords(words))
      .orderBy(searchText(products.description), firstProductCode)
      .limit(limit)
      .all()
  )

const upsert = (transaction: Connection, product: Product) => {
  const { codes, ...row } = product
  transaction
    .insert(products)
    .values(row)
    .onConflictDoUpdate({ target: products.id, set: row })
    .run()
  transaction
    .delete(productCodes)
    .where(eq(productCodes.productId, product.id))
    .run()
  transaction
    .insert(productCodes)
    .values(codes.map((code) => ({ productId: product.id, code })))
    .run()
}

const addCodes = (transaction: Connection, id: string, codes: string[]) =>
  transaction
    .insert(productCodes)
    .values(codes.map((code) => ({ productId: id, code })))
    .onConflictDoNothing()
    .run()

const updateVoiceText = (
  database: Connection,
  id: string,
  voiceText: string | null
): Product | undefined => {
  const row = database
    .update(products)
    .set({ voiceText })
    .where(eq(products.id, id))
    .returning()
    .get()
  return row && attachCodes(database, [row])[0]
}

const updatePhoto = (database: Connection, id: string, photo: string | null) =>
  database.update(products).set({ photo }).where(eq(products.id, id)).run()

const deleteByIds = (database: Connection, ids: string[]) =>
  database.delete(products).where(inArray(products.id, ids)).run()

const isInOffer = (database: Connection, ids: string[]) =>
  database
    .select({ productId: offerPageItems.productId })
    .from(offerPageItems)
    .where(inArray(offerPageItems.productId, ids))
    .limit(1)
    .get() !== undefined

const moveOfferItems = (
  transaction: Connection,
  fromIds: string[],
  toId: string
) =>
  transaction
    .update(offerPageItems)
    .set({ productId: toId })
    .where(inArray(offerPageItems.productId, fromIds))
    .run()

// In page order, then by position
const listOfferItems = (database: Connection, productId: string) =>
  database
    .select()
    .from(offerPageItems)
    .where(eq(offerPageItems.productId, productId))
    .orderBy(offerPageItems.pageId, offerPageItems.position)
    .all()

const deleteOfferItem = (
  transaction: Connection,
  { pageId, position }: { pageId: number; position: number }
) =>
  transaction
    .delete(offerPageItems)
    .where(
      and(
        eq(offerPageItems.pageId, pageId),
        eq(offerPageItems.position, position)
      )
    )
    .run()

export const productRepo = {
  findById,
  listByIds,
  listByCode,
  listAll,
  listWithPhoto,
  listCodes,
  listMatching,
  searchMatching,
  upsert,
  addCodes,
  updateVoiceText,
  updatePhoto,
  deleteByIds,
  isInOffer,
  moveOfferItems,
  listOfferItems,
  deleteOfferItem
}
