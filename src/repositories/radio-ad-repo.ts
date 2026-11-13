import { asc } from 'drizzle-orm'

import type { Database } from '@/infra/database/relations'
import { pronunciations, radioScriptTemplate } from '@/infra/database/schema'

const TEMPLATE_ID = 1

// In the order the store wrote them
const listPronunciations = (database: Database) =>
  database
    .select({ term: pronunciations.term, spoken: pronunciations.spoken })
    .from(pronunciations)
    .orderBy(asc(pronunciations.position))
    .all()

// Rewritten as a whole, like templates, so removing and reordering need no diff
const replacePronunciations = (
  database: Database,
  entries: { term: string; spoken: string }[]
) =>
  database.transaction((transaction) => {
    transaction.delete(pronunciations).run()
    if (entries.length === 0) return
    transaction
      .insert(pronunciations)
      .values(entries.map((entry, position) => ({ ...entry, position })))
      .run()
  })

const findTemplate = (database: Database) =>
  database.select().from(radioScriptTemplate).get()

const saveTemplate = (
  database: Database,
  values: Omit<typeof radioScriptTemplate.$inferInsert, 'id'>
) =>
  database
    .insert(radioScriptTemplate)
    .values({ id: TEMPLATE_ID, ...values })
    .onConflictDoUpdate({ target: radioScriptTemplate.id, set: values })
    .run()

export const radioAdRepo = {
  listPronunciations,
  replacePronunciations,
  findTemplate,
  saveTemplate
}
