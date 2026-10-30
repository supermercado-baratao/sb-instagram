import { asc } from 'drizzle-orm'

import type { Pronunciation } from '@/domain/pronunciation'
import type { Database } from '@/infra/database/relations'
import { pronunciations } from '@/infra/database/schema'

export const listPronunciations = (database: Database): Pronunciation[] =>
  database
    .select({ term: pronunciations.term, spoken: pronunciations.spoken })
    .from(pronunciations)
    .orderBy(asc(pronunciations.position))
    .all()

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
