import type { RadioScript } from '@/domain/radio-script'

export type OfferGeneration = {
  id: number
  offerId: number
  number: number
  pageCount: number
  // Read from the stored export, so a generation keeps the validity it was generated with
  validUntil: string | null
  radioScript: RadioScript | null
  createdAt: Date
}

export const GENERATION_PDF_FILE_NAME = 'paginas.pdf'

export const getGenerationPageFileName = (pageNumber: number) =>
  `pagina-${pageNumber}.png`

export const isGenerationPageNumber = (
  generation: Pick<OfferGeneration, 'pageCount'>,
  pageNumber: number
) =>
  Number.isSafeInteger(pageNumber) &&
  pageNumber >= 1 &&
  pageNumber <= generation.pageCount
