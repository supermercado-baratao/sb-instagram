import { database } from '@/infra/database/client'
import { findGeneration } from '@/infra/generation'

// A generation never changes after it is written and its id is never reused (AUTOINCREMENT)
export const IMMUTABLE_CACHE_CONTROL = 'private, max-age=31536000, immutable'

export const findGenerationByParams = async (
  params: Promise<{ id: string }>
) => {
  const { id } = await params
  const generationId = Number(id)
  return Number.isSafeInteger(generationId)
    ? findGeneration(database, generationId)
    : undefined
}
