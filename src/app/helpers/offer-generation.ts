import type { OfferGeneration } from '@/domain/offer-generation'

type GenerationReference = Pick<OfferGeneration, 'id' | 'offerId'>

export const getGenerationHref = (
  generation: GenerationReference,
  file: string
) => `/ofertas/${generation.offerId}/geracoes/${generation.id}/${file}`

export const getGenerationPageHref = (
  generation: GenerationReference,
  pageNumber: number
) => getGenerationHref(generation, `pagina/${pageNumber}`)
