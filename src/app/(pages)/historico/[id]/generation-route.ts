import { database } from '@/infra/database/client'
import { generationModel } from '@/models/generation/model'

// A generation never changes after it is written and its id is never reused (AUTOINCREMENT)
export const IMMUTABLE_CACHE_CONTROL = 'private, max-age=31536000, immutable'

export const findGenerationByParams = async (
  params: Promise<{ id: string }>
) => {
  const { id } = await params
  return generationModel.findById(database, Number(id))
}
