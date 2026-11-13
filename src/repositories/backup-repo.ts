import 'server-only'

import { count } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'

import type { Database } from '@/infra/database/relations'
import {
  brand,
  generations,
  offerPageItems,
  offerPages,
  products,
  pronunciations
} from '@/infra/database/schema'

const countRows = (database: Database, table: SQLiteTable) =>
  database.select({ count: count() }).from(table).get()?.count ?? 0

// What a restore replaces, so the store compares it with the backup before confirming
const summarize = (database: Database) => ({
  brandName:
    database.select({ name: brand.name }).from(brand).get()?.name ?? null,
  productCount: countRows(database, products),
  offerPageCount: countRows(database, offerPages),
  offerProductCount: countRows(database, offerPageItems),
  generationCount: countRows(database, generations),
  pronunciationCount: countRows(database, pronunciations)
})

export const backupRepo = {
  summarize
}
