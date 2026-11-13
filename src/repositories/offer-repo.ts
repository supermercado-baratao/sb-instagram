import { inArray } from 'drizzle-orm'

import type { Database } from '@/infra/database/relations'
import {
  offerBackup,
  offerPageItems,
  offerPages,
  offers,
  products
} from '@/infra/database/schema'

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

type Connection = Database | Transaction

const OFFER_ID = 1
const BACKUP_ID = 1

type OfferFields = Omit<typeof offers.$inferInsert, 'id'>

type PageRow = Omit<typeof offerPages.$inferInsert, 'id' | 'position'> & {
  items: Omit<typeof offerPageItems.$inferInsert, 'pageId'>[]
}

const findOffer = (database: Connection) =>
  database.query.offers.findFirst().sync()

// In order, each item with its product and the product's codes
const listPages = (database: Connection) =>
  database.query.offerPages
    .findMany({
      orderBy: { position: 'asc' },
      with: {
        items: {
          with: {
            product: { with: { codes: { orderBy: { code: 'asc' } } } }
          }
        }
      }
    })
    .sync()

// Pages are rewritten as a whole, so reordering never trips over the unique position
const write = (
  transaction: Connection,
  fields: OfferFields,
  pages: PageRow[]
) => {
  transaction
    .insert(offers)
    .values({ id: OFFER_ID, ...fields })
    .onConflictDoUpdate({ target: offers.id, set: fields })
    .run()
  transaction.delete(offerPages).run()

  for (const [position, page] of pages.entries()) {
    const { id: pageId } = transaction
      .insert(offerPages)
      .values({ position, templateId: page.templateId, layout: page.layout })
      .returning({ id: offerPages.id })
      .get()

    if (page.items.length > 0) {
      transaction
        .insert(offerPageItems)
        .values(page.items.map((item) => ({ pageId, ...item })))
        .run()
    }
  }
}

const findBackup = (database: Connection) =>
  database.select().from(offerBackup).get()

const writeBackup = (transaction: Connection, content: unknown) => {
  const fields = { content, replacedAt: new Date() }
  transaction
    .insert(offerBackup)
    .values({ id: BACKUP_ID, ...fields })
    .onConflictDoUpdate({ target: offerBackup.id, set: fields })
    .run()
}

const listExistingProductIds = (database: Connection, ids: string[]) => {
  if (ids.length === 0) return new Set<string>()
  const rows = database
    .select({ id: products.id })
    .from(products)
    .where(inArray(products.id, ids))
    .all()
  return new Set(rows.map(({ id }) => id))
}

export const offerRepo = {
  findOffer,
  listPages,
  write,
  findBackup,
  writeBackup,
  listExistingProductIds
}
