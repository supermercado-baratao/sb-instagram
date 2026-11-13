import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import { removeUnfinishedBackups } from '@/infra/backup'
import { database } from '@/infra/database/client'
import { migrationsFolder } from '@/infra/database/file'
import { removeUnfinishedGenerations } from '@/infra/generation'
import { productModel } from '@/models/product/model'

export const runMigrations = async () => {
  migrate(database, { migrationsFolder })
  await productModel.renameOutdatedPhotos(database)
  await removeUnfinishedGenerations()
  await removeUnfinishedBackups()
}
