import 'server-only'

import type { Database } from '@/infra/database/relations'
import type { ProductDetails } from '@/models/product/product'
import { radioAdRepo } from '@/repositories/radio-ad-repo'

import {
  getPronunciationsError,
  INITIAL_PRONUNCIATIONS,
  normalizePronunciations,
  type Pronunciation,
  type PronunciationError
} from './pronunciation'
import {
  convertLegacyBlocks,
  getRadioScriptTemplateError,
  INITIAL_RADIO_SCRIPT_TEMPLATE,
  normalizeRadioScriptTemplate,
  type RadioScriptClosingField,
  type RadioScriptTemplate
} from './radio-script'
import {
  closingSequenceSchema,
  closingsSchema,
  legacyBlocksSchema,
  priceMarkersSchema,
  radioAdSettingsSchema
} from './schema'
import { suggestVoiceText as suggest } from './spoken-text'

// The dictionary is saved with the script template, so a missing template row tells a page never
// saved from a store that removed every term on purpose
const listPronunciations = (database: Database): Pronunciation[] => {
  const saved = radioAdRepo.listPronunciations(database)
  if (saved.length > 0) return saved
  return radioAdRepo.findTemplate(database) ? saved : INITIAL_PRONUNCIATIONS
}

const findTemplate = (database: Database): RadioScriptTemplate => {
  const row = radioAdRepo.findTemplate(database)
  if (!row) return INITIAL_RADIO_SCRIPT_TEMPLATE
  const priceMarkers =
    priceMarkersSchema.safeParse(row.priceMarkers).data ??
    INITIAL_RADIO_SCRIPT_TEMPLATE.priceMarkers
  const { speakRepeatedOnce } = row
  const closings = closingsSchema.safeParse(row.closings)
  const sequence = closingSequenceSchema.safeParse(row.sequence)
  if (row.opening !== null && closings.success && sequence.success) {
    return {
      opening: row.opening,
      closings: closings.data,
      sequence: sequence.data,
      priceMarkers,
      speakRepeatedOnce
    }
  }
  // Saved before #123 as a fixed sequence of blocks (see the schema)
  const blocks = legacyBlocksSchema.safeParse(row.blocks)
  return {
    ...(blocks.success
      ? convertLegacyBlocks(blocks.data)
      : INITIAL_RADIO_SCRIPT_TEMPLATE),
    priceMarkers,
    speakRepeatedOnce
  }
}

export type SaveRadioAdResult =
  | {
      status: 'saved'
      pronunciations: Pronunciation[]
      radioScript: RadioScriptTemplate
    }
  | ({ status: 'invalid' } & Partial<PronunciationError> & {
        message: string
        closingIndex?: number
        closingField?: RadioScriptClosingField
      })

// The dictionary and the template are saved together, which is what tells a saved page apart
const save = (database: Database, input: unknown): SaveRadioAdResult => {
  const { pronunciations, radioScript } = radioAdSettingsSchema.parse(input)
  const radioScriptError = getRadioScriptTemplateError(radioScript)
  if (radioScriptError) {
    return {
      status: 'invalid',
      message: radioScriptError.message,
      closingIndex: radioScriptError.index,
      closingField: radioScriptError.field
    }
  }
  const error = getPronunciationsError(pronunciations)
  if (error) return { status: 'invalid', ...error }

  const normalized = normalizePronunciations(pronunciations)
  const template = normalizeRadioScriptTemplate(radioScript)
  database.transaction((transaction) => {
    radioAdRepo.replacePronunciations(transaction, normalized)
    radioAdRepo.saveTemplate(transaction, { ...template, blocks: null })
  })
  return { status: 'saved', pronunciations: normalized, radioScript: template }
}

const readText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

// Takes what the form holds, saved or not, since the store suggests while it types
const suggestVoiceText = (
  database: Database,
  details: Record<keyof ProductDetails, unknown>
) =>
  suggest(
    {
      description: readText(details.description),
      unit: readText(details.unit) || null
    },
    listPronunciations(database)
  )

export const radioAdModel = {
  listPronunciations,
  findTemplate,
  save,
  suggestVoiceText
}
