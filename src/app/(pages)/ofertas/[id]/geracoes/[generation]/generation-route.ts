import { database } from '@/infra/database/client'
import { findOfferGeneration } from '@/infra/offer-generation'

// A generation never changes after it is written and its id is never reused (AUTOINCREMENT)
export const IMMUTABLE_CACHE_CONTROL = 'private, max-age=31536000, immutable'

export const findGenerationByParams = async (
  params: Promise<{ id: string; generation: string }>
) => {
  const { id, generation } = await params
  const offerId = Number(id)
  const generationId = Number(generation)
  if (!Number.isSafeInteger(offerId) || !Number.isSafeInteger(generationId)) {
    return
  }
  return findOfferGeneration(database, offerId, generationId)
}
