import { GENERATION_PDF_FILE_NAME } from '@/domain/generation'
import {
  type GenerationPage,
  isGenerationPages
} from '@/domain/generation-pages'
import { isRadioScript, type RadioScript } from '@/domain/radio-script'

const GENERATION_ARCHIVE_FORMAT = 'sb-instagram-generation'

export const GENERATION_ARCHIVE_VERSION = 1

export const GENERATION_MANIFEST_NAME = 'geracao.json'

export const OFFER_EXPORT_FILE_NAME = 'ofertas.json'

export const RADIO_SCRIPT_FILE_NAME = 'roteiro.md'

export const RADIO_LIST_FILE_NAME = 'lista.md'

// Far above any real offer, only so a crafted file can't ask for an endless list of pages
const MAX_GENERATION_PAGE_COUNT = 500

export type GenerationManifest = {
  format: typeof GENERATION_ARCHIVE_FORMAT
  version: number
  number: number
  pageCount: number
  createdAt: string
  radioScript: RadioScript | null
  // Optional within version 1: generations recorded before #119 have none
  pages?: GenerationPage[]
}

export type GenerationImportPreview = {
  token: string
  number: number
  pageCount: number
  createdAt: string
  validUntil: string | null
  nextNumber: number
}

export type PrepareGenerationImportResponse =
  | ({ status: 'ready' } & GenerationImportPreview)
  | { status: 'error'; message: string }

export type GenerationArchiveEntry =
  | { type: 'manifest' | 'offer-export' | 'pdf' | 'radio-text' }
  | { type: 'page'; pageNumber: number }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1

// Checks the shape only, so a newer version is told apart from a file that isn't a generation
export const isGenerationManifest = (
  value: unknown
): value is GenerationManifest =>
  isRecord(value) &&
  value.format === GENERATION_ARCHIVE_FORMAT &&
  isPositiveInteger(value.version) &&
  isPositiveInteger(value.number) &&
  isPositiveInteger(value.pageCount) &&
  value.pageCount <= MAX_GENERATION_PAGE_COUNT &&
  typeof value.createdAt === 'string' &&
  !Number.isNaN(Date.parse(value.createdAt)) &&
  (value.radioScript === null || isRadioScript(value.radioScript)) &&
  (value.pages === undefined || isGenerationPages(value.pages))

export const createGenerationManifest = ({
  number,
  pageCount,
  createdAt,
  radioScript,
  pages
}: {
  number: number
  pageCount: number
  createdAt: Date
  radioScript: RadioScript | null
  pages: GenerationPage[] | null
}): GenerationManifest => ({
  format: GENERATION_ARCHIVE_FORMAT,
  version: GENERATION_ARCHIVE_VERSION,
  number,
  pageCount,
  createdAt: createdAt.toISOString(),
  radioScript,
  ...(pages && { pages })
})

const PAGE_FILE_PATTERN = /^pagina-([1-9]\d*)\.png$/

// Names come from an uploaded file, so only the archive's own names are accepted
export const getGenerationArchiveEntry = (
  name: string
): GenerationArchiveEntry | undefined => {
  if (name === GENERATION_MANIFEST_NAME) return { type: 'manifest' }
  if (name === OFFER_EXPORT_FILE_NAME) return { type: 'offer-export' }
  if (name === GENERATION_PDF_FILE_NAME) return { type: 'pdf' }
  if (name === RADIO_SCRIPT_FILE_NAME || name === RADIO_LIST_FILE_NAME) {
    return { type: 'radio-text' }
  }
  const match = PAGE_FILE_PATTERN.exec(name)
  if (!match) return
  const pageNumber = Number(match[1])
  return pageNumber <= MAX_GENERATION_PAGE_COUNT
    ? { type: 'page', pageNumber }
    : undefined
}

// The pages must be exactly 1 to pageCount, so an imported generation never links to a missing page
export const hasEveryPage = (pageNumbers: Set<number>, pageCount: number) =>
  pageNumbers.size === pageCount &&
  [...pageNumbers].every((pageNumber) => pageNumber <= pageCount)

// paginas.zip already downloads as oferta-<n>-artes.zip
export const getGenerationArchiveName = (number: number) =>
  `oferta-${number}-completa.zip`
