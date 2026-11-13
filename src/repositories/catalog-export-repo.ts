import 'server-only'

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import { catalogExports } from '@/infra/database/schema'

type Database = BetterSQLite3Database

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

const listAll = (database: Database | Transaction) =>
  database.select().from(catalogExports).all()

const upsert = (
  transaction: Database | Transaction,
  row: typeof catalogExports.$inferInsert
) =>
  transaction
    .insert(catalogExports)
    .values(row)
    .onConflictDoUpdate({
      target: catalogExports.productId,
      set: { fingerprint: row.fingerprint, exportedAt: row.exportedAt }
    })
    .run()

export const catalogExportRepo = {
  listAll,
  upsert
}
