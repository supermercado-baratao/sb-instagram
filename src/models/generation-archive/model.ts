import { randomUUID } from 'node:crypto'

import { type Zippable, zipSync } from 'fflate'

import {
  getRadioListMarkdown,
  getRadioScriptMarkdown
} from '@/domain/radio-script'
import type { Database } from '@/infra/database/relations'
import { AppError } from '@/infra/errors'
import {
  generationsDirectory,
  getTemporaryGenerationFolder,
  hasFileSignature,
  hasFolderFile,
  readFolderText,
  removeFolder,
  removeFolderFile
} from '@/infra/generation-files'
import { extractZip } from '@/infra/zip'
import {
  GENERATION_PDF_FILE_NAME,
  getGenerationPageFileName
} from '@/models/generation/generation'
import { generationModel } from '@/models/generation/model'
import { generationPagesSchema } from '@/models/generation/schema'
import { storedOfferExportSchema } from '@/models/offer/schema'
import { generationRepo } from '@/repositories/generation-repo'

import {
  createGenerationManifest,
  GENERATION_ARCHIVE_VERSION,
  GENERATION_MANIFEST_NAME,
  type GenerationImportPreview,
  type GenerationManifest,
  getGenerationArchiveEntry,
  hasEveryPage,
  OFFER_EXPORT_FILE_NAME,
  RADIO_LIST_FILE_NAME,
  RADIO_SCRIPT_FILE_NAME
} from './archive'
import { generationManifestSchema, importTokenSchema } from './schema'

type GenerationArchiveOptions = { directory?: string }

const INVALID_ARCHIVE_MESSAGE =
  'O arquivo não é uma oferta do histórico do app. Escolha o arquivo .zip baixado em "Baixar tudo (ZIP)".'

const NEWER_VERSION_MESSAGE =
  'Esta oferta foi baixada numa versão mais nova do app. Atualize o app antes de importá-la.'

const MISSING_IMPORT_MESSAGE =
  'Arquivo da oferta não encontrado. Envie o arquivo de novo.'

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

const PDF_SIGNATURE = Buffer.from('%PDF-')

const encoder = new TextEncoder()

const create = async (
  database: Database,
  id: number,
  { directory = generationsDirectory }: GenerationArchiveOptions = {}
) => {
  const generation = generationModel.findById(database, id)
  const stored = generationModel.findTexts(database, id)
  if (!generation || !stored) return

  const { offerExport, pages } = stored
  const manifest = createGenerationManifest({
    ...generation,
    pages: generationPagesSchema.safeParse(pages).data ?? null
  })
  // PNG and PDF are already compressed, so only the texts are deflated
  const files: Zippable = {
    [GENERATION_MANIFEST_NAME]: encoder.encode(
      JSON.stringify(manifest, null, 2)
    ),
    [OFFER_EXPORT_FILE_NAME]: encoder.encode(offerExport)
  }
  if (generation.radioScript) {
    files[RADIO_SCRIPT_FILE_NAME] = encoder.encode(
      getRadioScriptMarkdown(generation.radioScript)
    )
    files[RADIO_LIST_FILE_NAME] = encoder.encode(
      getRadioListMarkdown(generation.radioScript)
    )
  }
  const binaries = [
    ...Array.from({ length: generation.pageCount }, (_, index) =>
      getGenerationPageFileName(index + 1)
    ),
    GENERATION_PDF_FILE_NAME
  ]
  for (const fileName of binaries) {
    const data = await generationModel.readFile(id, fileName, { directory })
    if (!data) return
    files[fileName] = [data, { level: 0 }]
  }
  return { generation, archive: zipSync(files) }
}

const getImportFolder = (token: unknown, directory: string) => {
  const parsed = importTokenSchema.safeParse(token)
  if (!parsed.success) throw new AppError(MISSING_IMPORT_MESSAGE)
  return getTemporaryGenerationFolder(parsed.data, directory)
}

const readJson = async (folder: string, fileName: string): Promise<unknown> =>
  JSON.parse(await readFolderText(folder, fileName))

type ImportedTexts = {
  manifest: GenerationManifest
  offerExport: string
  validUntil: string | null
}

const readTexts = async (folder: string): Promise<ImportedTexts> => {
  const manifest = generationManifestSchema.safeParse(
    await readJson(folder, GENERATION_MANIFEST_NAME)
  )
  if (!manifest.success) throw new AppError(INVALID_ARCHIVE_MESSAGE)
  if (manifest.data.version > GENERATION_ARCHIVE_VERSION) {
    throw new AppError(NEWER_VERSION_MESSAGE)
  }
  const offerExport = await readFolderText(folder, OFFER_EXPORT_FILE_NAME)
  const exported = storedOfferExportSchema.safeParse(JSON.parse(offerExport))
  if (!exported.success) throw new AppError(INVALID_ARCHIVE_MESSAGE)
  return {
    manifest: manifest.data,
    offerExport,
    validUntil: exported.data.validUntil
  }
}

// Each file must be what its name says, so an imported generation never serves a broken page
const checkFiles = async (
  folder: string,
  names: Set<string>,
  pageCount: number
) => {
  const pageNumbers = new Set<number>()
  for (const name of names) {
    const entry = getGenerationArchiveEntry(name)
    if (entry?.type === 'page') pageNumbers.add(entry.pageNumber)
  }
  if (!hasEveryPage(pageNumbers, pageCount)) return false
  for (const pageNumber of pageNumbers) {
    const page = getGenerationPageFileName(pageNumber)
    if (!(await hasFileSignature(folder, page, PNG_SIGNATURE))) return false
  }
  return hasFileSignature(folder, GENERATION_PDF_FILE_NAME, PDF_SIGNATURE)
}

const asArchiveError = (error: unknown) =>
  error instanceof AppError ? error : new AppError(INVALID_ARCHIVE_MESSAGE)

// Nothing is added until importGeneration: the file is only extracted and checked, so the store
// sees the generation first. The folder takes the generations' temporary prefix, so a restart
// before the store confirms clears it (removeUnfinished)
const prepareImport = async (
  database: Database,
  archive: AsyncIterable<Uint8Array>,
  { directory = generationsDirectory }: GenerationArchiveOptions = {}
): Promise<GenerationImportPreview> => {
  const token = randomUUID()
  const folder = getImportFolder(token, directory)
  try {
    let names: Set<string>
    try {
      names = await extractZip(archive, folder, (name) => {
        const entry = getGenerationArchiveEntry(name)
        if (!entry) return
        // Rebuilt from the manifest's radio script, like a generation recorded here
        return entry.type === 'radio-text' ? null : [name]
      })
    } catch {
      throw new AppError(INVALID_ARCHIVE_MESSAGE)
    }
    const { manifest, validUntil } = await readTexts(folder)
    if (!(await checkFiles(folder, names, manifest.pageCount))) {
      throw new AppError(INVALID_ARCHIVE_MESSAGE)
    }
    return {
      token,
      number: manifest.number,
      pageCount: manifest.pageCount,
      createdAt: manifest.createdAt,
      validUntil,
      nextNumber: generationRepo.findLastNumber(database) + 1
    }
  } catch (error) {
    await removeFolder(folder)
    throw asArchiveError(error)
  }
}

// Always added, with the next number of this instance and the date it was first generated
const importPrepared = async (
  database: Database,
  token: unknown,
  { directory = generationsDirectory }: GenerationArchiveOptions = {}
) => {
  const folder = getImportFolder(token, directory)
  if (!(await hasFolderFile(folder, GENERATION_MANIFEST_NAME))) {
    throw new AppError(MISSING_IMPORT_MESSAGE)
  }
  try {
    // The files were checked by prepareImport, so only the texts are read again
    let texts: ImportedTexts
    try {
      texts = await readTexts(folder)
    } catch (error) {
      throw asArchiveError(error)
    }
    const { manifest, offerExport } = texts
    await removeFolderFile(folder, GENERATION_MANIFEST_NAME)
    await removeFolderFile(folder, OFFER_EXPORT_FILE_NAME)
    return await generationModel.record(
      database,
      folder,
      () => ({
        offerExport,
        pageCount: manifest.pageCount,
        radioScript: manifest.radioScript,
        pages: manifest.pages ?? null,
        createdAt: new Date(manifest.createdAt)
      }),
      directory
    )
  } catch (error) {
    await removeFolder(folder)
    throw error
  }
}

const discardImport = async (
  token: unknown,
  { directory = generationsDirectory }: GenerationArchiveOptions = {}
) => removeFolder(getImportFolder(token, directory))

export const generationArchiveModel = {
  create,
  prepareImport,
  importPrepared,
  discardImport
}
