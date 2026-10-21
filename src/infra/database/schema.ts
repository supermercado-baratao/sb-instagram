import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'

import { CODE_TYPES } from '@/domain/product'

export const products = sqliteTable(
  'products',
  {
    code: text().notNull(),
    codeType: text({ enum: CODE_TYPES }).notNull(),
    name: text().notNull(),
    brand: text(),
    unit: text(),
    photo: text()
  },
  // A non-integer SQLite primary key accepts NULL unless the column is NOT NULL, and drizzle-kit
  // drops NOT NULL from a column-level text().primaryKey() (https://sqlite.org/lang_createtable.html#the_primary_key)
  (table) => [primaryKey({ columns: [table.code] })]
)

export const offers = sqliteTable('offers', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  // ISO date (YYYY-MM-DD), formatted for the poster only when it is rendered
  validUntil: text(),
  highlightTitle: text().notNull(),
  highlightMessage: text().notNull(),
  createdAt: integer({ mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer({ mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
})

export const offerPages = sqliteTable(
  'offer_pages',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    offerId: integer()
      .notNull()
      .references(() => offers.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    templateId: text().notNull(),
    layout: integer().notNull()
  },
  (table) => [
    uniqueIndex('offer_pages_offer_id_position_unique').on(
      table.offerId,
      table.position
    )
  ]
)

// An empty slot has no row, so a page keeps the position of each product
export const offerPageItems = sqliteTable(
  'offer_page_items',
  {
    pageId: integer().notNull(),
    position: integer().notNull(),
    productCode: text().notNull(),
    priceInCents: integer().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.pageId, table.position] }),
    foreignKey({
      columns: [table.pageId],
      foreignColumns: [offerPages.id]
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.productCode],
      foreignColumns: [products.code]
    })
  ]
)

// One row per instance, since each store runs its own instance
export const brand = sqliteTable(
  'brand',
  {
    id: integer().primaryKey(),
    name: text().notNull(),
    slogan: text().notNull(),
    instagram: text().notNull(),
    logo: text(),
    // Versions the logo URL, so milliseconds keep two saves within a second apart
    updatedAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  (table) => [check('brand_single_row', sql`${table.id} = 1`)]
)

// Offer pages keep the template id without a foreign key, so deleting a template leaves them on
// the first one (getPageTemplate) instead of failing or deleting the pages
export const templates = sqliteTable(
  'templates',
  {
    id: text().notNull(),
    name: text().notNull(),
    primaryColor: text().notNull(),
    accentColor: text().notNull(),
    position: integer().notNull()
  },
  (table) => [primaryKey({ columns: [table.id] })]
)
