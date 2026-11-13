import { z } from 'zod'

import {
  isPosterLayout,
  PAGE_PRODUCT_COUNT,
  type PosterLayout
} from '@/models/poster/poster'
import { productIdSchema, storedCodeSchema } from '@/models/product/schema'

const generationPageItemSchema = z.object({
  position: z
    .number()
    .int()
    .min(0)
    .max(PAGE_PRODUCT_COUNT - 1),
  // Null for a page rebuilt from the export of a generation recorded before #119
  productId: productIdSchema.nullable(),
  // Kept beside the id, so a generation imported from another instance still finds its products
  codes: z.array(storedCodeSchema),
  priceInCents: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
})

const generationPageSchema = z.object({
  // Null when rebuilt from an old export, which kept neither
  templateId: z.string().nullable(),
  layout: z.custom<PosterLayout>((value) => isPosterLayout(value)).nullable(),
  items: z.array(generationPageItemSchema)
})

// Read from the database or an imported archive, so a list written by a future version or edited
// by hand is never copied
export const generationPagesSchema = z.array(generationPageSchema)

export type GenerationPageItem = z.output<typeof generationPageItemSchema>

export type GenerationPage = z.output<typeof generationPageSchema>

// Every export version keeps each product's codes and price, in the order the poster shows them
const exportProductSchema = z.object({
  codes: z.array(storedCodeSchema),
  price: z.string()
})

const exportPageSchema = z.object({ products: z.array(exportProductSchema) })

export const exportPagesSchema = z.object({ pages: z.array(exportPageSchema) })

export const generationIdSchema = z.number().int().positive()

export const copyPagesSchema = z.object({
  id: generationIdSchema,
  pageNumbers: z.array(z.number().int())
})
