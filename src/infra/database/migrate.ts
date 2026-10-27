import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import { database } from '@/infra/database/client'
import { migrationsFolder } from '@/infra/database/file'
import { renameOutdatedPhotos } from '@/infra/product'

export const runMigrations = async () => {
  migrate(database, { migrationsFolder })
  await renameOutdatedPhotos(database)
}
