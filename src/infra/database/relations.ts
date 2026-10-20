import { defineRelations } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import * as schema from '@/infra/database/schema'

export const relations = defineRelations(schema, (r) => ({
  offers: {
    pages: r.many.offerPages({ from: r.offers.id, to: r.offerPages.offerId })
  },
  offerPages: {
    items: r.many.offerPageItems({
      from: r.offerPages.id,
      to: r.offerPageItems.pageId
    })
  },
  offerPageItems: {
    product: r.one.products({
      from: r.offerPageItems.productCode,
      to: r.products.code,
      optional: false
    })
  }
}))

export type Database = BetterSQLite3Database<typeof relations>
