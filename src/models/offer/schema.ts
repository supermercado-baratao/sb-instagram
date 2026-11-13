import { z } from 'zod'

import {
  isPosterLayout,
  PAGE_PRODUCT_COUNT,
  type PosterLayout
} from '@/models/poster/poster'
import { productIdSchema, productSchema } from '@/models/product/schema'

import { ISO_DATE_PATTERN } from './offer'

const layoutSchema = z.custom<PosterLayout>((value) => isPosterLayout(value))

const priceSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

const slotSchema = z
  .object({
    // The editor sends the whole product, but saving only keeps its id
    product: productSchema.extend({
      voiceText: z.string().nullable().default(null)
    }),
    priceInCents: priceSchema
  })
  .nullable()

const pageSchema = z.object({
  templateId: z.string(),
  layout: layoutSchema,
  slots: z.array(slotSchema).length(PAGE_PRODUCT_COUNT)
})

// A Server Action is a public endpoint, so the editor's content is checked again on the server
export const offerContentSchema = z.object({
  validUntil: z.string().regex(ISO_DATE_PATTERN).nullable(),
  highlightTitle: z.string(),
  highlightMessage: z.string(),
  pages: z.array(pageSchema).min(1)
})

const snapshotItemSchema = z.object({
  position: z
    .number()
    .int()
    .min(0)
    .max(PAGE_PRODUCT_COUNT - 1),
  productId: productIdSchema,
  priceInCents: priceSchema
})

const snapshotPageSchema = z.object({
  templateId: z.string(),
  layout: layoutSchema,
  items: z.array(snapshotItemSchema)
})

// The stored copy is JSON, so one written by a future version or edited by hand is never restored
export const offerSnapshotSchema = z.object({
  validUntil: z.string().nullable(),
  highlightTitle: z.string(),
  highlightMessage: z.string(),
  pages: z.array(snapshotPageSchema).min(1)
})

// Generations keep the version they were recorded with, so an imported one may hold any of them.
// Only what the app reads back (the validity) is checked, the rest is the store's file
export const storedOfferExportSchema = z.looseObject({
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  validUntil: z.string().nullable(),
  pages: z.array(z.unknown())
})
