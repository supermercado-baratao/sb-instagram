import { defineRelations } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import * as schema from './schema'

export const relations = defineRelations(schema, (r) => ({
  offerPages: {
    items: r.many.offerPageItems({
      from: r.offerPages.id,
      to: r.offerPageItems.pageId
    })
  },
  offerPageItems: {
    product: r.one.products({
      from: r.offerPageItems.productId,
      to: r.products.id,
      optional: false
    })
  },
  products: {
    codes: r.many.productCodes({
      from: r.products.id,
      to: r.productCodes.productId
    })
  }
}))

export type Database = BetterSQLite3Database<typeof relations>
