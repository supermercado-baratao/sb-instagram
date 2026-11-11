import type { Generation } from '@/domain/generation'

export const GENERATIONS_PATH = '/historico'

export const GENERATIONS_HEADING_ID = 'generations-heading'

export const getGenerationHref = (
  generation: Pick<Generation, 'id'>,
  file: string
) => `${GENERATIONS_PATH}/${generation.id}/${file}`

export const getGenerationPageHref = (
  generation: Pick<Generation, 'id'>,
  pageNumber: number
) => getGenerationHref(generation, `pagina/${pageNumber}`)
