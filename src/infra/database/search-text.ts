import type BetterSqlite3 from 'better-sqlite3'
import { type SQL, sql } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'

import { normalizeSearchText } from '@/domain/product'

// SQLite folds case only for ASCII and has no built-in way to drop accents (https://sqlite.org/lang_corefunc.html#lower)
export const registerSearchText = (sqlite: BetterSqlite3.Database) =>
  sqlite.function('search_text', { deterministic: true }, (text) =>
    typeof text === 'string' ? normalizeSearchText(text) : text
  )

export const searchText = (column: SQLiteColumn): SQL =>
  sql`search_text(${column})`
