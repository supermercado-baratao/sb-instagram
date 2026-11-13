import { removeUnfinishedBackups } from '@/infra/backup'
import { database } from '@/infra/database/client'
import { migrateDatabase } from '@/infra/database/migrate'
import { generationModel } from '@/models/generation/model'
import { productModel } from '@/models/product/model'

// Runs once when the server starts (register() in src/instrumentation.ts), before any request
export const startInstance = async () => {
  migrateDatabase()
  await productModel.renameOutdatedPhotos(database)
  await generationModel.removeUnfinished()
  await removeUnfinishedBackups()
}
