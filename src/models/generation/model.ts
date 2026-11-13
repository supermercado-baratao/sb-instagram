import 'server-only'

import { randomUUID } from 'node:crypto'

import { zipSync } from 'fflate'

import type { Database } from '@/infra/database/relations'
import { AppError } from '@/infra/errors'
import {
  createFolder,
  generationsDirectory,
  getGenerationFolder,
  getTemporaryGenerationFolder,
  moveToGenerationFolder,
  readGenerationFile,
  removeFolder,
  removeTemporaryGenerationFolders,
  writeFolderFile
} from '@/infra/generation-files'
import { offerRenderer } from '@/infra/poster-renderer'
import { brandModel } from '@/models/brand/model'
import { offerModel } from '@/models/offer/model'
import { getOfferExport } from '@/models/offer/offer-export'
import { productModel } from '@/models/product/model'
import { radioAdModel } from '@/models/radio-ad/model'
import { getRadioScript } from '@/models/radio-ad/radio-script'
import { radioScriptSchema } from '@/models/radio-ad/schema'
import { generationRepo } from '@/repositories/generation-repo'

import {
  type Generation,
  GENERATION_PDF_FILE_NAME,
  getGenerationPageFileName,
  isGenerationPageNumber
} from './generation'
import {
  appendGenerationPages,
  getGenerationPages,
  getGenerationPagesFromExport,
  resolveGenerationProduct,
  selectGenerationPages
} from './pages'
import {
  copyPagesSchema,
  generationIdSchema,
  type GenerationPage,
  generationPagesSchema
} from './schema'

export type OfferRenderer = {
  renderPage: (pageNumber: number) => Promise<Uint8Array>
  renderPdf: () => Promise<Uint8Array>
}

type GenerationOptions = { directory?: string }

const MISSING_GENERATION_MESSAGE = 'Esta oferta não está mais no histórico.'

type GenerationRow = Omit<Generation, 'radioScript'> & { radioScript: unknown }

// The script is stored JSON, so one that isn't a script is shown as none
const toGeneration = ({ radioScript, ...row }: GenerationRow): Generation => ({
  ...row,
  radioScript: radioScriptSchema.safeParse(radioScript).data ?? null
})

const list = (database: Database): Generation[] =>
  generationRepo.list(database).map((row) => toGeneration(row))

// The id comes from the URL, so anything but a generation's id finds nothing
const findById = (database: Database, id: unknown): Generation | undefined => {
  const parsed = generationIdSchema.safeParse(id)
  const row = parsed.success
    ? generationRepo.findById(database, parsed.data)
    : undefined
  return row && toGeneration(row)
}

const findExport = (database: Database, id: number) =>
  generationRepo.findTexts(database, id)?.offerExport

const findTexts = (database: Database, id: number) =>
  generationRepo.findTexts(database, id)

const readFile = (
  generationId: number,
  fileName: string,
  { directory = generationsDirectory }: GenerationOptions = {}
) => readGenerationFile(generationId, fileName, directory)

const readPage = (
  generation: Generation,
  pageNumber: number,
  options: GenerationOptions = {}
) =>
  isGenerationPageNumber(generation, pageNumber)
    ? readFile(generation.id, getGenerationPageFileName(pageNumber), options)
    : undefined

const readPdf = (generation: Generation, options: GenerationOptions = {}) =>
  readFile(generation.id, GENERATION_PDF_FILE_NAME, options)

// PNG is already compressed, so the files are only stored
const createPagesArchive = async (
  generation: Generation,
  options: GenerationOptions = {}
) => {
  const files: Record<string, Uint8Array> = {}
  for (let pageNumber = 1; pageNumber <= generation.pageCount; pageNumber++) {
    const png = await readPage(generation, pageNumber, options)
    if (!png) return
    files[getGenerationPageFileName(pageNumber)] = png
  }
  return zipSync(files, { level: 0 })
}

// A generation recorded before #119 has no pages of its own, so they are rebuilt from its export
const findPages = (
  database: Database,
  id: number
): GenerationPage[] | undefined => {
  const row = generationRepo.findTexts(database, id)
  if (!row) return
  if (row.pages !== null) {
    const parsed = generationPagesSchema.safeParse(row.pages)
    return parsed.success ? parsed.data : undefined
  }
  try {
    return getGenerationPagesFromExport(JSON.parse(row.offerExport))
  } catch {
    return
  }
}

export type CopyGenerationPagesResult = {
  status: 'copied'
  pageCount: number
  missingProductCount: number
}

// The generation never changes: its pages are appended to the current offer, which keeps the
// version it replaces, so "Voltar à versão anterior" undoes the copy
const copyPages = (
  database: Database,
  input: { id: unknown; pageNumbers: unknown }
): CopyGenerationPagesResult => {
  const { id, pageNumbers } = copyPagesSchema.parse(input)
  const pages = findPages(database, id)
  const selected = pages && selectGenerationPages(pages, pageNumbers)
  const offer = offerModel.findCurrent(database)
  const templateIds = brandModel
    .listTemplates(database)
    .map((template) => template.id)
  if (!selected || !offer || templateIds.length === 0) {
    throw new AppError(
      'Não foi possível copiar estas artes. Recarregue a página e tente de novo.'
    )
  }

  const { content, missingProductCount } = appendGenerationPages(
    offer,
    selected,
    {
      templateIds,
      findProduct: (item) =>
        resolveGenerationProduct(
          item,
          (productId) => productModel.findById(database, productId),
          (codes) => productModel.findWithCodes(database, codes)
        )
    }
  )
  offerModel.save(database, content)
  return { status: 'copied', pageCount: selected.length, missingProductCount }
}

type GenerationValues = Omit<
  Parameters<typeof generationRepo.insert>[1],
  'id' | 'number'
>

// The number is the next one of this instance, and the files only take the generation's id once
// its row exists, so a failure halfway never leaves a generation with missing files
const record = async (
  database: Database,
  temporary: string,
  getValues: (transaction: Database) => GenerationValues,
  directory = generationsDirectory
): Promise<Generation> => {
  const generation = toGeneration(
    database.transaction((transaction) =>
      generationRepo.insert(transaction, {
        ...getValues(transaction),
        number: generationRepo.findLastNumber(transaction) + 1
      })
    )
  )

  try {
    await moveToGenerationFolder(temporary, generation.id, directory)
  } catch (error) {
    generationRepo.deleteById(database, generation.id)
    throw error
  }
  return generation
}

const create = async (
  database: Database,
  renderer: OfferRenderer = offerRenderer,
  { directory = generationsDirectory }: GenerationOptions = {}
): Promise<Generation> => {
  const offer = offerModel.findCurrent(database)
  if (!offer) throw new AppError('Salve a oferta antes de gerar.')

  const temporary = getTemporaryGenerationFolder(randomUUID(), directory)
  await createFolder(temporary)
  try {
    // One page at a time, so a long offer doesn't open a Chromium tab per page at once
    for (const index of offer.pages.keys()) {
      const pageNumber = index + 1
      await writeFolderFile(
        temporary,
        getGenerationPageFileName(pageNumber),
        await renderer.renderPage(pageNumber)
      )
    }
    await writeFolderFile(
      temporary,
      GENERATION_PDF_FILE_NAME,
      await renderer.renderPdf()
    )

    return await record(
      database,
      temporary,
      (transaction) => ({
        // Indented, since the store opens the file to read or edit it by hand
        offerExport: JSON.stringify(getOfferExport(offer), null, 2),
        pageCount: offer.pages.length,
        pages: getGenerationPages(offer),
        radioScript: getRadioScript(
          offer,
          radioAdModel.findTemplate(transaction),
          radioAdModel.listPronunciations(transaction)
        )
      }),
      directory
    )
  } catch (error) {
    await removeFolder(temporary)
    throw error
  }
}

const remove = async (
  database: Database,
  id: unknown,
  { directory = generationsDirectory }: GenerationOptions = {}
) => {
  const parsed = generationIdSchema.safeParse(id)
  if (!parsed.success || !generationRepo.deleteById(database, parsed.data)) {
    throw new AppError(MISSING_GENERATION_MESSAGE)
  }
  await removeFolder(getGenerationFolder(parsed.data, directory))
}

const removeUnfinished = (directory = generationsDirectory) =>
  removeTemporaryGenerationFolders(directory)

export const generationModel = {
  list,
  findById,
  findExport,
  findTexts,
  readFile,
  readPage,
  readPdf,
  createPagesArchive,
  copyPages,
  record,
  create,
  remove,
  removeUnfinished
}
