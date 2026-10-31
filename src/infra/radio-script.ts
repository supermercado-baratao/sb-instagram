import {
  INITIAL_RADIO_SCRIPT_TEMPLATE,
  type RadioScriptTemplate
} from '@/domain/radio-script'
import type { Database } from '@/infra/database/relations'
import { radioScriptTemplate } from '@/infra/database/schema'

const TEMPLATE_ID = 1

export const findRadioScriptTemplate = (
  database: Database
): RadioScriptTemplate =>
  database
    .select({
      opening: radioScriptTemplate.opening,
      beforeBlock: radioScriptTemplate.beforeBlock,
      afterBlock: radioScriptTemplate.afterBlock,
      closing: radioScriptTemplate.closing,
      priceMarkers: radioScriptTemplate.priceMarkers
    })
    .from(radioScriptTemplate)
    .get() ?? INITIAL_RADIO_SCRIPT_TEMPLATE

export const saveRadioScriptTemplate = (
  database: Database,
  template: RadioScriptTemplate
) =>
  database
    .insert(radioScriptTemplate)
    .values({ id: TEMPLATE_ID, ...template })
    .onConflictDoUpdate({ target: radioScriptTemplate.id, set: template })
    .run()
