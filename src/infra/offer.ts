import {
  createOfferContent,
  type OfferContent,
  type OfferPage,
  placeSlots
} from '@/domain/offer'
import { DEFAULT_POSTER_LAYOUT, isPosterLayout } from '@/domain/poster'
import type { Database } from '@/infra/database/relations'
import { offerPageItems, offerPages, offers } from '@/infra/database/schema'

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

export const OFFER_ID = 1

export const findOffer = (database: Database): OfferContent | undefined => {
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

const insertPages = (transaction: Transaction, pages: OfferPage[]) => {
  for (const [position, page] of pages.entries()) {
    const { id: pageId } = transaction
      .insert(offerPages)
      .values({
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
              productId: slot.product.id,
              priceInCents: slot.priceInCents
            }
          ]
        : []
    )
    if (items.length > 0) transaction.insert(offerPageItems).values(items).run()
  }
}

// Pages are rewritten as a whole, so reordering never trips over the unique position
export const saveOffer = (database: Database, content: OfferContent) =>
  database.transaction((transaction) => {
    const fields = {
      validUntil: content.validUntil,
      highlightTitle: content.highlightTitle,
      highlightMessage: content.highlightMessage
    }
    transaction
      .insert(offers)
      .values({ id: OFFER_ID, ...fields })
      .onConflictDoUpdate({ target: offers.id, set: fields })
      .run()
    transaction.delete(offerPages).run()
    insertPages(transaction, content.pages)
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
