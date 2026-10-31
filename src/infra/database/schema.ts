import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'

import type { RadioScript, RadioScriptBlock } from '@/domain/radio-script'

export const products = sqliteTable(
  'products',
  {
    // A random UUID (crypto.randomUUID), since a product has no main code to be keyed by (#55)
    id: text().notNull(),
    name: text().notNull(),
    brand: text(),
    unit: text(),
    // How the radio ad speaks the product; null falls back to suggestVoiceText (#72)
    voiceText: text(),
    // File name inside photos/, derived by getPhotoFileName and renamed when the codes change
    photo: text()
  },
  // A non-integer SQLite primary key accepts NULL unless the column is NOT NULL, and drizzle-kit
  // drops NOT NULL from a column-level text().primaryKey() (https://sqlite.org/lang_createtable.html#the_primary_key)
  (table) => [primaryKey({ columns: [table.id] })]
)

// A code may be in several products (e.g. a single fragrance and the group of all of them), so
// no two products may have the same set of codes instead, which saveProduct checks (#55)
export const productCodes = sqliteTable(
  'product_codes',
  {
    productId: text().notNull(),
    code: text().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.code] }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id]
    }).onDelete('cascade'),
    index('product_codes_code_index').on(table.code)
  ]
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
    productId: text().notNull(),
    priceInCents: integer().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.pageId, table.position] }),
    foreignKey({
      columns: [table.pageId],
      foreignColumns: [offerPages.id]
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id]
    })
  ]
)

// What an offer looked like when it was generated, so editing a product or the brand later never
// changes it. AUTOINCREMENT never reuses an id, so the files' URLs can be cached as immutable
export const offerGenerations = sqliteTable(
  'offer_generations',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    offerId: integer()
      .notNull()
      .references(() => offers.id, { onDelete: 'cascade' }),
    number: integer().notNull(),
    offerExport: text().notNull(),
    pageCount: integer().notNull(),
    // Null for generations recorded before the radio ad script existed (#76)
    radioScript: text({ mode: 'json' }).$type<RadioScript>(),
    createdAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  (table) => [
    uniqueIndex('offer_generations_offer_id_number_unique').on(
      table.offerId,
      table.number
    )
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

// Rewritten as a whole on save, like templates; terms are unique ignoring case, which
// getPronunciationsError checks, since SQLite's NOCASE only folds ASCII
export const pronunciations = sqliteTable(
  'pronunciations',
  {
    term: text().notNull(),
    spoken: text().notNull(),
    position: integer().notNull()
  },
  (table) => [primaryKey({ columns: [table.term] })]
)

// One row per instance, like the brand
export const radioScriptTemplate = sqliteTable(
  'radio_script_template',
  {
    id: integer().primaryKey(),
    blocks: text({ mode: 'json' }).$type<RadioScriptBlock[]>().notNull(),
    priceMarkers: text({ mode: 'json' }).$type<string[]>().notNull()
  },
  (table) => [check('radio_script_template_single_row', sql`${table.id} = 1`)]
)
