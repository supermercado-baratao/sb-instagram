import type { Database } from '@/infra/database/relations'
import { AppError } from '@/infra/errors'
import { DEFAULT_POSTER_LAYOUT, isPosterLayout } from '@/models/poster/poster'
import { offerRepo } from '@/repositories/offer-repo'

import {
  createOfferContent,
  dropMissingProducts,
  getSnapshotProductIds,
  isSameOfferSnapshot,
  type OfferBackupSummary,
  type OfferContent,
  type OfferSnapshot,
  placeSlots,
  toOfferSnapshot
} from './offer'
import { offerContentSchema, offerSnapshotSchema } from './schema'

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

const findCurrent = (
  database: Database | Transaction
): OfferContent | undefined => {
  const offer = offerRepo.findOffer(database)
  if (!offer) return undefined

  return {
    validUntil: offer.validUntil,
    highlightTitle: offer.highlightTitle,
    highlightMessage: offer.highlightMessage,
    pages: offerRepo.listPages(database).map((page) => ({
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

const write = (transaction: Transaction, snapshot: OfferSnapshot) =>
  offerRepo.write(
    transaction,
    {
      validUntil: snapshot.validUntil,
      highlightTitle: snapshot.highlightTitle,
      highlightMessage: snapshot.highlightMessage
    },
    snapshot.pages
  )

const readBackup = (database: Database | Transaction) => {
  const row = offerRepo.findBackup(database)
  if (!row) return
  const parsed = offerSnapshotSchema.safeParse(row.content)
  return parsed.success
    ? { snapshot: parsed.data, replacedAt: row.replacedAt }
    : undefined
}

const dropDeletedProducts = (
  database: Database | Transaction,
  snapshot: OfferSnapshot
) =>
  dropMissingProducts(
    snapshot,
    offerRepo.listExistingProductIds(database, getSnapshotProductIds(snapshot))
  )

// Keeps the saved version a save replaces, so a mistaken save can be undone (#92)
const save = (database: Database, input: unknown) => {
  const content: OfferContent = offerContentSchema.parse(input)
  database.transaction((transaction) => {
    const next = toOfferSnapshot(content)
    const current = findCurrent(transaction)
    if (current) {
      const previous = toOfferSnapshot(current)
      if (!isSameOfferSnapshot(previous, next)) {
        offerRepo.writeBackup(transaction, previous)
      }
    }
    write(transaction, next)
  })
}

const findBackup = (database: Database): OfferBackupSummary | undefined => {
  const backup = readBackup(database)
  if (!backup) return undefined

  const { snapshot, missingProductCount } = dropDeletedProducts(
    database,
    backup.snapshot
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
const restoreBackup = (database: Database) => {
  const restored = database.transaction((transaction) => {
    const backup = readBackup(transaction)
    const current = findCurrent(transaction)
    if (!backup || !current) return

    const { snapshot, missingProductCount } = dropDeletedProducts(
      transaction,
      backup.snapshot
    )
    offerRepo.writeBackup(transaction, toOfferSnapshot(current))
    write(transaction, snapshot)
    return { missingProductCount }
  })
  const content = restored && findCurrent(database)
  if (!content) {
    throw new AppError('Não há uma versão anterior da oferta para voltar.')
  }
  return { content, missingProductCount: restored.missingProductCount }
}

// A new instance has no offer until its brand exists, since a page needs a template
const findOrCreate = (database: Database, templateId: string): OfferContent => {
  const offer = findCurrent(database)
  if (offer) return offer

  const content = createOfferContent(templateId)
  save(database, content)
  return content
}

export const offerModel = {
  findCurrent,
  findOrCreate,
  save,
  findBackup,
  restoreBackup
}
