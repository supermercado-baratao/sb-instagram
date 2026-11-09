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

import type { OfferSnapshot } from '@/domain/offer'
import type { RadioScript, RadioScriptBlock } from '@/domain/radio-script'

export const products = sqliteTable(
  'products',
  {
    // A random UUID (crypto.randomUUID), since a product has no main code to be keyed by (#55)
    id: text().notNull(),
    // Name and brand as one text, since the poster shows them together (#99)
    description: text().notNull(),
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

// What the last catalog export took of each product, so the next one takes only new or changed
// products (#66)
export const catalogExports = sqliteTable(
  'catalog_exports',
  {
    productId: text().notNull(),
    // Hash of the description, unit, codes and photo bytes, see getCatalogFingerprint
    fingerprint: text().notNull(),
    exportedAt: integer({ mode: 'timestamp_ms' }).notNull()
  },
  (table) => [
    primaryKey({ columns: [table.productId] }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id]
    }).onDelete('cascade')
  ]
)

// One row per instance, since the store only works on its current offer (#80)
export const offers = sqliteTable(
  'offers',
  {
    id: integer().primaryKey(),
    // ISO date (YYYY-MM-DD), formatted for the poster only when it is rendered
    validUntil: text(),
    highlightTitle: text().notNull(),
    highlightMessage: text().notNull()
  },
  (table) => [check('offers_single_row', sql`${table.id} = 1`)]
)

export const offerPages = sqliteTable(
  'offer_pages',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    position: integer().notNull(),
    templateId: text().notNull(),
    layout: integer().notNull()
  },
  (table) => [uniqueIndex('offer_pages_position_unique').on(table.position)]
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

// The offer as it was before the last save that changed it, so a mistaken save can be undone
// (#92). It points to products without a foreign key, so it never keeps a product from being
// deleted
export const offerBackup = sqliteTable(
  'offer_backup',
  {
    id: integer().primaryKey(),
    content: text({ mode: 'json' }).$type<OfferSnapshot>().notNull(),
    replacedAt: integer({ mode: 'timestamp_ms' }).notNull()
  },
  (table) => [check('offer_backup_single_row', sql`${table.id} = 1`)]
)

// What an offer looked like when it was generated, so editing a product, the brand or the offer
// later never changes it. AUTOINCREMENT never reuses an id, so the files' URLs can be cached as
// immutable
export const generations = sqliteTable(
  'generations',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    number: integer().notNull(),
    offerExport: text().notNull(),
    pageCount: integer().notNull(),
    // Null for generations recorded before the radio ad script existed (#76)
    radioScript: text({ mode: 'json' }).$type<RadioScript>(),
    createdAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  (table) => [uniqueIndex('generations_number_unique').on(table.number)]
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
