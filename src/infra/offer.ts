import { inArray } from 'drizzle-orm'

import {
  createOfferContent,
  dropMissingProducts,
  getSnapshotProductIds,
  isOfferSnapshot,
  isSameOfferSnapshot,
  type OfferBackupSummary,
  type OfferContent,
  type OfferSnapshot,
  placeSlots,
  toOfferSnapshot
} from '@/domain/offer'
import { DEFAULT_POSTER_LAYOUT, isPosterLayout } from '@/domain/poster'
import type { Database } from '@/infra/database/relations'
import {
  offerBackup,
  offerPageItems,
  offerPages,
  offers,
  products
} from '@/infra/database/schema'

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

const OFFER_ID = 1
const BACKUP_ID = 1

export const findOffer = (
  database: Database | Transaction
): OfferContent | undefined => {
  const offer = database.query.offers.findFirst().sync()
  if (!offer) return undefined

  const pages = database.query.offerPages
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

  return {
    validUntil: offer.validUntil,
    highlightTitle: offer.highlightTitle,
    highlightMessage: offer.highlightMessage,
    pages: pages.map((page) => ({
      templateId: page.templateId,
      layout: isPosterLayout(page.layout) ? page.layout : DEFAULT_POSTER_LAYOUT,
      slots: placeSlots(
        page.items.map(({ product: { codes, ...product }, ...item }) => ({
          ...item,
          product: { ...product, codes: codes.map(({ code }) => code) }
        }))
      )
    }))
  }
}

// Pages are rewritten as a whole, so reordering never trips over the unique position
const writeOffer = (transaction: Transaction, snapshot: OfferSnapshot) => {
  const fields = {
    validUntil: snapshot.validUntil,
    highlightTitle: snapshot.highlightTitle,
    highlightMessage: snapshot.highlightMessage
  }
  transaction
    .insert(offers)
    .values({ id: OFFER_ID, ...fields })
    .onConflictDoUpdate({ target: offers.id, set: fields })
    .run()
  transaction.delete(offerPages).run()

  for (const [position, page] of snapshot.pages.entries()) {
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

const writeBackup = (transaction: Transaction, snapshot: OfferSnapshot) => {
  const fields = { content: snapshot, replacedAt: new Date() }
  transaction
    .insert(offerBackup)
    .values({ id: BACKUP_ID, ...fields })
    .onConflictDoUpdate({ target: offerBackup.id, set: fields })
    .run()
}

const findExistingProductIds = (
  database: Database | Transaction,
  snapshot: OfferSnapshot
) => {
  const ids = getSnapshotProductIds(snapshot)
  if (ids.length === 0) return new Set<string>()
  const rows = database
    .select({ id: products.id })
    .from(products)
    .where(inArray(products.id, ids))
    .all()
  return new Set(rows.map(({ id }) => id))
}

const readBackup = (database: Database | Transaction) => {
  const row = database.select().from(offerBackup).get()
  if (!row || !isOfferSnapshot(row.content)) return
  return { snapshot: row.content, replacedAt: row.replacedAt }
}

// Keeps the saved version a save replaces, so a mistaken save can be undone (#92)
export const saveOffer = (database: Database, content: OfferContent) =>
  database.transaction((transaction) => {
    const next = toOfferSnapshot(content)
    const current = findOffer(transaction)
    if (current) {
      const previous = toOfferSnapshot(current)
      if (!isSameOfferSnapshot(previous, next)) {
        writeBackup(transaction, previous)
      }
    }
    writeOffer(transaction, next)
  })

export const findOfferBackup = (
  database: Database
): OfferBackupSummary | undefined => {
  const backup = readBackup(database)
  if (!backup) return undefined

  const { snapshot, missingProductCount } = dropMissingProducts(
    backup.snapshot,
    findExistingProductIds(database, backup.snapshot)
  )
  return {
    replacedAt: backup.replacedAt.getTime(),
    pageCount: snapshot.pages.length,
    productCount: snapshot.pages.reduce(
      (count, page) => count + page.items.length,
      0
    ),
    missingProductCount
  }
}

// Swaps the offer with the stored copy, so restoring again undoes the restore
export const restoreOfferBackup = (database: Database) =>
  database.transaction((transaction) => {
    const backup = readBackup(transaction)
    const current = findOffer(transaction)
    if (!backup || !current) return

    const { snapshot, missingProductCount } = dropMissingProducts(
      backup.snapshot,
      findExistingProductIds(transaction, backup.snapshot)
    )
    writeBackup(transaction, toOfferSnapshot(current))
    writeOffer(transaction, snapshot)
    return { missingProductCount }
  })

// A new instance has no offer until its brand exists, since a page needs a template
export const findOrCreateOffer = (
  database: Database,
  templateId: string
): OfferContent => {
  const offer = findOffer(database)
  if (offer) return offer

  const content = createOfferContent(templateId)
  saveOffer(database, content)
  return content
}
