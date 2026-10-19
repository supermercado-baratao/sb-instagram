import { count, desc, eq } from 'drizzle-orm'

import {
  getCopyName,
  type OfferContent,
  type OfferPage,
  type OfferSummary,
  placeSlots,
  type SavedOffer
} from '@/domain/offer'
import { DEFAULT_POSTER_LAYOUT, isPosterLayout } from '@/domain/poster'
import type { Database } from '@/infra/database/relations'
import { offerPageItems, offerPages, offers } from '@/infra/database/schema'

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

export const listOffers = (database: Database): OfferSummary[] =>
  database
    .select({
      id: offers.id,
      name: offers.name,
      validUntil: offers.validUntil,
      pageCount: count(offerPages.id),
      updatedAt: offers.updatedAt
    })
    .from(offers)
    .leftJoin(offerPages, eq(offerPages.offerId, offers.id))
    .groupBy(offers.id)
    .orderBy(desc(offers.updatedAt), desc(offers.id))
    .all()

export const findOffer = (
  database: Database,
  id: number
): SavedOffer | undefined => {
  const offer = database.query.offers
    .findFirst({
      where: { id },
      with: {
        pages: {
          orderBy: { position: 'asc' },
          with: { items: { with: { product: true } } }
        }
      }
    })
    .sync()
  if (!offer) return undefined

  return {
    id: offer.id,
    name: offer.name,
    validUntil: offer.validUntil,
    highlightTitle: offer.highlightTitle,
    highlightMessage: offer.highlightMessage,
    pages: offer.pages.map((page) => ({
      templateId: page.templateId,
      layout: isPosterLayout(page.layout) ? page.layout : DEFAULT_POSTER_LAYOUT,
      slots: placeSlots(page.items)
    }))
  }
}

const getOfferFields = (content: OfferContent) => ({
  name: content.name,
  validUntil: content.validUntil,
  highlightTitle: content.highlightTitle,
  highlightMessage: content.highlightMessage
})

const insertPages = (
  transaction: Transaction,
  offerId: number,
  pages: OfferPage[]
) => {
  for (const [position, page] of pages.entries()) {
    const { id: pageId } = transaction
      .insert(offerPages)
      .values({
        offerId,
        position,
        templateId: page.templateId,
        layout: page.layout
      })
      .returning({ id: offerPages.id })
      .get()

    const items = page.slots.flatMap((slot, slotPosition) =>
      slot
        ? [
            {
              pageId,
              position: slotPosition,
              productCode: slot.product.code,
              priceInCents: slot.priceInCents
            }
          ]
        : []
    )
    if (items.length > 0) transaction.insert(offerPageItems).values(items).run()
  }
}

export const createOffer = (database: Database, content: OfferContent) =>
  database.transaction((transaction) => {
    const { id } = transaction
      .insert(offers)
      .values(getOfferFields(content))
      .returning({ id: offers.id })
      .get()
    insertPages(transaction, id, content.pages)
    return id
  })

// Pages are rewritten as a whole, so reordering never trips over the unique position per offer
export const saveOffer = (
  database: Database,
  id: number,
  content: OfferContent
) =>
  database.transaction((transaction) => {
    const { changes } = transaction
      .update(offers)
      .set(getOfferFields(content))
      .where(eq(offers.id, id))
      .run()
    if (changes === 0) return false

    transaction.delete(offerPages).where(eq(offerPages.offerId, id)).run()
    insertPages(transaction, id, content.pages)
    return true
  })

export const duplicateOffer = (database: Database, id: number) => {
  const offer = findOffer(database, id)
  if (!offer) return
  return createOffer(database, { ...offer, name: getCopyName(offer.name) })
}

export const deleteOffer = (database: Database, id: number) => {
  database.delete(offers).where(eq(offers.id, id)).run()
}
