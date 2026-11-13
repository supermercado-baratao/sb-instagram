import {
  convertLegacyBlocks,
  INITIAL_RADIO_SCRIPT_TEMPLATE,
  isLegacyRadioScriptBlocks,
  type RadioScriptTemplate
} from '@/domain/radio-script'
import type { Database } from '@/infra/database/relations'
import { radioScriptTemplate } from '@/infra/database/schema'

const TEMPLATE_ID = 1

export const findRadioScriptTemplate = (
  database: Database
): RadioScriptTemplate => {
  const row = database.select().from(radioScriptTemplate).get()
  if (!row) return INITIAL_RADIO_SCRIPT_TEMPLATE
  const { opening, closings, sequence, priceMarkers, speakRepeatedOnce } = row
  if (opening !== null && closings !== null && sequence !== null) {
    return { opening, closings, sequence, priceMarkers, speakRepeatedOnce }
  }
  // Saved before #123 as a fixed sequence of blocks (see the schema)
  return {
    ...(isLegacyRadioScriptBlocks(row.blocks)
      ? convertLegacyBlocks(row.blocks)
      : INITIAL_RADIO_SCRIPT_TEMPLATE),
    priceMarkers,
    speakRepeatedOnce
  }
}

export const saveRadioScriptTemplate = (
  database: Database,
  template: RadioScriptTemplate
) => {
  const values = { ...template, blocks: null }
  database
    .insert(radioScriptTemplate)
    .values({ id: TEMPLATE_ID, ...values })
    .onConflictDoUpdate({ target: radioScriptTemplate.id, set: values })
    .run()
}
