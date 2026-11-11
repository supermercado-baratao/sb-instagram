import { inArray } from 'drizzle-orm'

import {
  INITIAL_RADIO_SCRIPT_TEMPLATE,
  type RadioScriptTemplate,
  withProductsBlockIds
} from '@/domain/radio-script'
import type { Database } from '@/infra/database/relations'
import {
  products,
  radioScriptProductBlocks,
  radioScriptTemplate
} from '@/infra/database/schema'

const TEMPLATE_ID = 1

export const findRadioScriptTemplate = (
  database: Database
): RadioScriptTemplate => {
  const row = database
    .select({
      blocks: radioScriptTemplate.blocks,
      priceMarkers: radioScriptTemplate.priceMarkers,
      speakRepeatedOnce: radioScriptTemplate.speakRepeatedOnce,
      splitEvenly: radioScriptTemplate.splitEvenly
    })
    .from(radioScriptTemplate)
    .get()
  if (!row) return INITIAL_RADIO_SCRIPT_TEMPLATE
  return {
    ...row,
    // Blocks saved before #111 have no id, and a moved product needs one to point to
    blocks: withProductsBlockIds(row.blocks),
    productBlocks: database
      .select({
        productId: radioScriptProductBlocks.productId,
        blockId: radioScriptProductBlocks.blockId
      })
      .from(radioScriptProductBlocks)
      .orderBy(radioScriptProductBlocks.productId)
      .all()
  }
}

// The moves are rewritten as a whole, like the dictionary; a product deleted while the tab was open
// is left out, since its row would break the foreign key
export const saveRadioScriptTemplate = (
  database: Database,
  { productBlocks, ...template }: RadioScriptTemplate
) => {
  database
    .insert(radioScriptTemplate)
    .values({ id: TEMPLATE_ID, ...template })
    .onConflictDoUpdate({ target: radioScriptTemplate.id, set: template })
    .run()
  database.delete(radioScriptProductBlocks).run()
  if (productBlocks.length === 0) return
  const productIds = productBlocks.map(({ productId }) => productId)
  const existing = new Set(
    database
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.id, productIds))
      .all()
      .map(({ id }) => id)
  )
  const rows = productBlocks.filter(({ productId }) => existing.has(productId))
  if (rows.length > 0) {
    database.insert(radioScriptProductBlocks).values(rows).run()
  }
}
