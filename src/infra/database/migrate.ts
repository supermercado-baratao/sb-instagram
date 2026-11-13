import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import { database } from '@/infra/database/client'
import { migrationsFolder } from '@/infra/database/file'

export const migrateDatabase = () => migrate(database, { migrationsFolder })
