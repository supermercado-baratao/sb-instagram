import { asc } from 'drizzle-orm'

import {
  INITIAL_PRONUNCIATIONS,
  type Pronunciation
} from '@/domain/pronunciation'
import type { Database } from '@/infra/database/relations'
import { pronunciations, radioScriptTemplate } from '@/infra/database/schema'

// The dictionary is saved with the script template, so a missing template row tells a tab never
// saved from a store that removed every term on purpose
export const listPronunciations = (database: Database): Pronunciation[] => {
  const saved = database
    .select({ term: pronunciations.term, spoken: pronunciations.spoken })
    .from(pronunciations)
    .orderBy(asc(pronunciations.position))
    .all()
  if (saved.length > 0) return saved
  const tabSaved = database
    .select({ id: radioScriptTemplate.id })
    .from(radioScriptTemplate)
    .get()
  return tabSaved ? saved : INITIAL_PRONUNCIATIONS
}

// Rewritten as a whole, like templates, so removing and reordering need no diff
export const savePronunciations = (
  database: Database,
  entries: Pronunciation[]
) =>
  database.transaction((transaction) => {
    transaction.delete(pronunciations).run()
    if (entries.length === 0) return
    transaction
      .insert(pronunciations)
      .values(entries.map((entry, position) => ({ ...entry, position })))
      .run()
  })
