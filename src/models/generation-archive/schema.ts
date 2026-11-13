import { z } from 'zod'

import { generationPagesSchema } from '@/models/generation/schema'
import { radioScriptSchema } from '@/models/radio-ad/schema'

import { GENERATION_ARCHIVE_FORMAT, MAX_GENERATION_PAGE_COUNT } from './archive'

const positiveInteger = z.number().int().positive()

// Checks the shape only, so a newer version is told apart from a file that isn't a generation
export const generationManifestSchema = z.object({
  format: z.literal(GENERATION_ARCHIVE_FORMAT),
  version: positiveInteger,
  number: positiveInteger,
  pageCount: positiveInteger.max(MAX_GENERATION_PAGE_COUNT),
  createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  radioScript: radioScriptSchema.nullable(),
  // Optional within version 1: generations recorded before #119 have none
  pages: generationPagesSchema.optional()
})

// The token names a temporary folder, so it must be one the server created
export const importTokenSchema = z.uuid()
