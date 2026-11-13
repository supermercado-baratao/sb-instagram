import { z } from 'zod'

import { SEQUENCE_PARTS } from './radio-script'

const closingIdSchema = z.number().int().positive()

const closingSchema = z.object({
  id: closingIdSchema,
  name: z.string(),
  text: z.string()
})

export const closingsSchema = z.array(closingSchema)

export const closingSequenceSchema = z.object(
  Object.fromEntries(
    SEQUENCE_PARTS.map((part) => [part, z.array(closingIdSchema)])
  ) as Record<
    (typeof SEQUENCE_PARTS)[number],
    z.ZodArray<typeof closingIdSchema>
  >
)

export const priceMarkersSchema = z.array(z.string())

export const radioScriptTemplateSchema = z.object({
  opening: z.string(),
  closings: closingsSchema,
  sequence: closingSequenceSchema,
  priceMarkers: priceMarkersSchema,
  speakRepeatedOnce: z.boolean()
})

const legacyBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z.string(),
    id: z.number().optional()
  }),
  z.object({
    type: z.literal('products'),
    pageCount: z.number(),
    id: z.number().optional()
  })
])

// The fixed sequence of blocks saved before #123, read only to convert it
export const legacyBlocksSchema = z.array(legacyBlockSchema)

export const pronunciationListSchema = z.array(
  z.object({ term: z.string(), spoken: z.string() })
)

// A Server Action is a public endpoint, so the content is checked again on the server
export const radioAdSettingsSchema = z.object({
  pronunciations: pronunciationListSchema,
  radioScript: radioScriptTemplateSchema
})

const listItemSchema = z.object({
  number: z.number(),
  text: z.string(),
  price: z.string()
})

const pageNumberSchema = z.number().int().positive()

// Generations keep the version they were generated with, so both are read
export const radioScriptSchema = z.discriminatedUnion('version', [
  z.object({
    version: z.literal(3),
    script: z.string(),
    list: z.array(listItemSchema)
  }),
  z.object({
    version: z.literal(2),
    script: z.string(),
    list: z.array(listItemSchema),
    unusedPages: z.array(pageNumberSchema),
    missingPageCount: z.number().int().nonnegative()
  })
])
