import {
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
