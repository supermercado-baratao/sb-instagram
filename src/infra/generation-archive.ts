import { randomUUID } from 'node:crypto'
import { open, readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'

import { max } from 'drizzle-orm'
import { type Zippable, zipSync } from 'fflate'

import {
  GENERATION_PDF_FILE_NAME,
  getGenerationPageFileName
} from '@/domain/generation'
import {
  createGenerationManifest,
  GENERATION_ARCHIVE_VERSION,
  GENERATION_MANIFEST_NAME,
  type GenerationImportPreview,
  type GenerationManifest,
  getGenerationArchiveEntry,
  hasEveryPage,
  isGenerationManifest,
  OFFER_EXPORT_FILE_NAME,
  RADIO_LIST_FILE_NAME,
  RADIO_SCRIPT_FILE_NAME
} from '@/domain/generation-archive'
import {
  getRadioListMarkdown,
  getRadioScriptMarkdown
} from '@/domain/radio-script'
import { isUuid } from '@/domain/uuid'
import type { Database } from '@/infra/database/relations'
import { generations } from '@/infra/database/schema'
import {
  findGeneration,
  findGenerationTexts,
  getTemporaryGenerationFolder,
  readGenerationFile,
  recordGeneration
} from '@/infra/generation'
import { generationsDirectory } from '@/infra/generations-directory'
import { extractZip } from '@/infra/zip'
import { storedOfferExportSchema } from '@/models/offer/schema'

type GenerationArchiveOptions = { directory?: string }

export class GenerationArchiveError extends Error {}

const INVALID_ARCHIVE_MESSAGE =
  'O arquivo não é uma oferta do histórico do app. Escolha o arquivo .zip baixado em "Baixar tudo (ZIP)".'

const NEWER_VERSION_MESSAGE =
  'Esta oferta foi baixada numa versão mais nova do app. Atualize o app antes de importá-la.'

const MISSING_IMPORT_MESSAGE =
  'Arquivo da oferta não encontrado. Envie o arquivo de novo.'

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

const PDF_SIGNATURE = Buffer.from('%PDF-')

const encoder = new TextEncoder()

export const createGenerationArchive = async (
  database: Database,
  id: number,
  { directory = generationsDirectory }: GenerationArchiveOptions = {}
) => {
  const generation = findGeneration(database, id)
  const stored = findGenerationTexts(database, id)
  if (!generation || !stored) return

  const { offerExport, pages } = stored
  const manifest = createGenerationManifest({ ...generation, pages })
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
    const data = await readGenerationFile(id, fileName, { directory })
    if (!data) return
    files[fileName] = [data, { level: 0 }]
  }
  return { generation, archive: zipSync(files) }
}

const getImportFolder = (token: string, directory: string) => {
  if (!isUuid(token)) {
    throw new GenerationArchiveError(MISSING_IMPORT_MESSAGE)
  }
  return getTemporaryGenerationFolder(token, directory)
}

const hasSignature = async (file: string, signature: Buffer) => {
  const handle = await open(file)
  try {
    const head = Buffer.alloc(signature.length)
    const { bytesRead } = await handle.read(head, 0, signature.length, 0)
    return bytesRead === signature.length && head.equals(signature)
  } finally {
    await handle.close()
  }
}

const readJson = async (file: string): Promise<unknown> =>
  JSON.parse(await readFile(file, 'utf8'))

type ImportedTexts = {
  manifest: GenerationManifest
  offerExport: string
  validUntil: string | null
}

const readTexts = async (folder: string): Promise<ImportedTexts> => {
  const manifest = await readJson(path.join(folder, GENERATION_MANIFEST_NAME))
  if (!isGenerationManifest(manifest)) {
    throw new GenerationArchiveError(INVALID_ARCHIVE_MESSAGE)
  }
  if (manifest.version > GENERATION_ARCHIVE_VERSION) {
    throw new GenerationArchiveError(NEWER_VERSION_MESSAGE)
  }
  const offerExport = await readFile(
    path.join(folder, OFFER_EXPORT_FILE_NAME),
    'utf8'
  )
  const exported = storedOfferExportSchema.safeParse(JSON.parse(offerExport))
  if (!exported.success) {
    throw new GenerationArchiveError(INVALID_ARCHIVE_MESSAGE)
  }
  return {
    manifest,
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
    const page = path.join(folder, getGenerationPageFileName(pageNumber))
    if (!(await hasSignature(page, PNG_SIGNATURE))) return false
  }
  return hasSignature(
    path.join(folder, GENERATION_PDF_FILE_NAME),
    PDF_SIGNATURE
  )
}

const asArchiveError = (error: unknown) =>
  error instanceof GenerationArchiveError
    ? error
    : new GenerationArchiveError(INVALID_ARCHIVE_MESSAGE)

const getNextNumber = (database: Database) =>
  (database
    .select({ number: max(generations.number) })
    .from(generations)
    .get()?.number ?? 0) + 1

// Nothing is added until importGeneration: the file is only extracted and checked, so the store
// sees the generation first. The folder takes the generations' temporary prefix, so a restart
// before the store confirms clears it (removeUnfinishedGenerations)
export const prepareGenerationImport = async (
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
      throw new GenerationArchiveError(INVALID_ARCHIVE_MESSAGE)
    }
    const { manifest, validUntil } = await readTexts(folder)
    if (!(await checkFiles(folder, names, manifest.pageCount))) {
      throw new GenerationArchiveError(INVALID_ARCHIVE_MESSAGE)
    }
    return {
      token,
      number: manifest.number,
      pageCount: manifest.pageCount,
      createdAt: manifest.createdAt,
      validUntil,
      nextNumber: getNextNumber(database)
    }
  } catch (error) {
    await rm(folder, { recursive: true, force: true })
    throw asArchiveError(error)
  }
}

const exists = async (file: string) => {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

// Always added, with the next number of this instance and the date it was first generated
export const importGeneration = async (
  database: Database,
  token: string,
  { directory = generationsDirectory }: GenerationArchiveOptions = {}
) => {
  const folder = getImportFolder(token, directory)
  const manifestFile = path.join(folder, GENERATION_MANIFEST_NAME)
  if (!(await exists(manifestFile))) {
    throw new GenerationArchiveError(MISSING_IMPORT_MESSAGE)
  }
  try {
    // The files were checked by prepareGenerationImport, so only the texts are read again
    let texts: ImportedTexts
    try {
      texts = await readTexts(folder)
    } catch (error) {
      throw asArchiveError(error)
    }
    const { manifest, offerExport } = texts
    await rm(manifestFile)
    await rm(path.join(folder, OFFER_EXPORT_FILE_NAME))
    return await recordGeneration(
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
    await rm(folder, { recursive: true, force: true })
    throw error
  }
}

export const discardGenerationImport = async (
  token: string,
  { directory = generationsDirectory }: GenerationArchiveOptions = {}
) => rm(getImportFolder(token, directory), { recursive: true, force: true })
