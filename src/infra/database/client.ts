import { mkdirSync } from 'node:fs'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { dataDirectory } from '@/infra/data-directory'
import { databaseFile } from '@/infra/database/file'
import { relations } from '@/infra/database/relations'
import { registerSearchText } from '@/infra/database/search-text'

const openDatabase = () => {
  mkdirSync(dataDirectory, { recursive: true })
  const sqlite = new Database(databaseFile)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  registerSearchText(sqlite)
  return drizzle({ client: sqlite, relations })
}

// Hot reload in `next dev` re-evaluates this module, which would open a new connection on every edit
const globalForDatabase = globalThis as unknown as {
  database?: ReturnType<typeof openDatabase>
}

export const database = globalForDatabase.database ?? openDatabase()

if (process.env.NODE_ENV !== 'production') globalForDatabase.database = database
