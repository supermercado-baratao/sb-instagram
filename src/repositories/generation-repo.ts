import { desc, eq, max, sql } from 'drizzle-orm'

import type { Database } from '@/infra/database/relations'
import { generations } from '@/infra/database/schema'

const generationColumns = {
  id: generations.id,
  number: generations.number,
  pageCount: generations.pageCount,
  validUntil: sql<
    string | null
  >`json_extract(${generations.offerExport}, '$.validUntil')`,
  radioScript: generations.radioScript,
  createdAt: generations.createdAt
}

// Newest first
const list = (database: Database) =>
  database
    .select(generationColumns)
    .from(generations)
    .orderBy(desc(generations.number))
    .all()

const findById = (database: Database, id: number) =>
  database
    .select(generationColumns)
    .from(generations)
    .where(eq(generations.id, id))
    .get()

const findTexts = (database: Database, id: number) =>
  database
    .select({ offerExport: generations.offerExport, pages: generations.pages })
    .from(generations)
    .where(eq(generations.id, id))
    .get()

const findLastNumber = (database: Database) =>
  database
    .select({ number: max(generations.number) })
    .from(generations)
    .get()?.number ?? 0

const insert = (database: Database, values: typeof generations.$inferInsert) =>
  database.insert(generations).values(values).returning(generationColumns).get()

const deleteById = (database: Database, id: number) =>
  database.delete(generations).where(eq(generations.id, id)).run().changes > 0

export const generationRepo = {
  list,
  findById,
  findTexts,
  findLastNumber,
  insert,
  deleteById
}
