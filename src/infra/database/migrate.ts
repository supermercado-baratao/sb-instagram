import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import { database } from './client'
import { migrationsFolder } from './file'

export const migrateDatabase = () => migrate(database, { migrationsFolder })
