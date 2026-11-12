import { randomUUID } from 'node:crypto'
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile
} from 'node:fs/promises'
import path from 'node:path'

import { desc, eq, max, sql } from 'drizzle-orm'

import {
  type Generation,
  GENERATION_PDF_FILE_NAME,
  getGenerationPageFileName
} from '@/domain/generation'
import {
  appendGenerationPages,
  type GenerationPage,
  getGenerationPages,
  getGenerationPagesFromExport,
  isGenerationPages,
  resolveGenerationProduct,
  selectGenerationPages
} from '@/domain/generation-pages'
import { getOfferExport } from '@/domain/offer-export'
import { getRadioScript } from '@/domain/radio-script'
import { listTemplates } from '@/infra/brand'
import type { Database } from '@/infra/database/relations'
import { generations } from '@/infra/database/schema'
import {
  generationsDirectory,
  getGenerationFolder
} from '@/infra/generations-directory'
import { findOffer, saveOffer } from '@/infra/offer'
import { findProductById, findProductWithCodes } from '@/infra/product'
import { listPronunciations } from '@/infra/pronunciation'
import { findRadioScriptTemplate } from '@/infra/radio-script'

export type OfferRenderer = {
  renderPage: (pageNumber: number) => Promise<Uint8Array>
  renderPdf: () => Promise<Uint8Array>
}

type GenerationOptions = { directory?: string }

const TEMPORARY_PREFIX = '.tmp-'

const generationColumns = {
  id: generations.id,
  number: generations.number,
  pageCount: generations.pageCount,
  validUntil: sql<
    string | null
  >`json_extract(${generations.offerExport}, '$.validUntil')`,
  radioScript: generations.radioScript,
  createdAt: generations.createdAt
}

export const listGenerations = (database: Database): Generation[] =>
  database
    .select(generationColumns)
    .from(generations)
    .orderBy(desc(generations.number))
    .all()

export const findGeneration = (
  database: Database,
  id: number
): Generation | undefined =>
  database
    .select(generationColumns)
    .from(generations)
    .where(eq(generations.id, id))
    .get()

export const findGenerationExport = (database: Database, id: number) =>
  findGenerationTexts(database, id)?.offerExport

export const findGenerationTexts = (database: Database, id: number) =>
  database
    .select({ offerExport: generations.offerExport, pages: generations.pages })
    .from(generations)
    .where(eq(generations.id, id))
    .get()

// A generation recorded before #119 has no pages of its own, so they are rebuilt from its export
export const findGenerationPages = (
  database: Database,
  id: number
): GenerationPage[] | undefined => {
  const row = findGenerationTexts(database, id)
  if (!row) return
  if (row.pages !== null) {
    return isGenerationPages(row.pages) ? row.pages : undefined
  }
  try {
    return getGenerationPagesFromExport(JSON.parse(row.offerExport))
  } catch {
    return
  }
}

export type CopyGenerationPagesResult =
  | { status: 'copied'; pageCount: number; missingProductCount: number }
  | { status: 'missing' }

// The generation never changes: its pages are appended to the current offer, which keeps the
// version it replaces, so "Voltar à versão anterior" undoes the copy
export const copyGenerationPages = (
  database: Database,
  id: number,
  pageNumbers: number[]
): CopyGenerationPagesResult => {
  const pages = findGenerationPages(database, id)
  const selected = pages && selectGenerationPages(pages, pageNumbers)
  const offer = findOffer(database)
  const templateIds = listTemplates(database).map((template) => template.id)
  if (!selected || !offer || templateIds.length === 0) {
    return { status: 'missing' }
  }

  const { content, missingProductCount } = appendGenerationPages(
    offer,
    selected,
    {
      templateIds,
      findProduct: (item) =>
        resolveGenerationProduct(
          item,
          (productId) => findProductById(database, productId),
          (codes) => findProductWithCodes(database, codes)
        )
    }
  )
  saveOffer(database, content)
  return { status: 'copied', pageCount: selected.length, missingProductCount }
}

export const getTemporaryGenerationFolder = (
  token: string,
  directory = generationsDirectory
) => path.join(directory, `${TEMPORARY_PREFIX}${token}`)

type GenerationValues = Omit<typeof generations.$inferInsert, 'id' | 'number'>

// The number is the next one of this instance, and the files only take the generation's id once
// its row exists, so a failure halfway never leaves a generation with missing files
export const recordGeneration = async (
  database: Database,
  temporary: string,
  getValues: (transaction: Database) => GenerationValues,
  directory = generationsDirectory
): Promise<Generation> => {
  const generation = database.transaction((transaction) => {
    const last = transaction
      .select({ number: max(generations.number) })
      .from(generations)
      .get()
    return transaction
      .insert(generations)
      .values({ ...getValues(transaction), number: (last?.number ?? 0) + 1 })
      .returning(generationColumns)
      .get()
  })

  try {
    await rename(temporary, getGenerationFolder(generation.id, directory))
  } catch (error) {
    database.delete(generations).where(eq(generations.id, generation.id)).run()
    throw error
  }
  return generation
}

export const createGeneration = async (
  database: Database,
  renderer: OfferRenderer,
  { directory = generationsDirectory }: GenerationOptions = {}
): Promise<Generation | undefined> => {
  const offer = findOffer(database)
  if (!offer) return undefined

  const temporary = getTemporaryGenerationFolder(randomUUID(), directory)
  await mkdir(temporary, { recursive: true })
  try {
    // One page at a time, so a long offer doesn't open a Chromium tab per page at once
    for (const index of offer.pages.keys()) {
      const pageNumber = index + 1
      await writeFile(
        path.join(temporary, getGenerationPageFileName(pageNumber)),
        await renderer.renderPage(pageNumber)
      )
    }
    await writeFile(
      path.join(temporary, GENERATION_PDF_FILE_NAME),
      await renderer.renderPdf()
    )

    return await recordGeneration(
      database,
      temporary,
      (transaction) => ({
        // Indented, since the store opens the file to read or edit it by hand
        offerExport: JSON.stringify(getOfferExport(offer), null, 2),
        pageCount: offer.pages.length,
        pages: getGenerationPages(offer),
        radioScript: getRadioScript(
          offer,
          findRadioScriptTemplate(transaction),
          listPronunciations(transaction)
        )
      }),
      directory
    )
  } catch (error) {
    await rm(temporary, { recursive: true, force: true })
    throw error
  }
}

// File names come from the generation's own constants, never from the request
export const readGenerationFile = async (
  generationId: number,
  fileName: string,
  { directory = generationsDirectory }: GenerationOptions = {}
) => {
  try {
    return await readFile(
      path.join(getGenerationFolder(generationId, directory), fileName)
    )
  } catch {
    return
  }
}

export const deleteGeneration = async (
  database: Database,
  id: number,
  { directory = generationsDirectory }: GenerationOptions = {}
) => {
  const { changes } = database
    .delete(generations)
    .where(eq(generations.id, id))
    .run()
  if (changes === 0) return false
  await rm(getGenerationFolder(id, directory), {
    recursive: true,
    force: true
  })
  return true
}

// A generation interrupted by a restart leaves its temporary folder behind
export const removeUnfinishedGenerations = async (
  directory = generationsDirectory
) => {
  let entries: string[]
  try {
    entries = await readdir(directory)
  } catch {
    return
  }
  await Promise.all(
    entries
      .filter((entry) => entry.startsWith(TEMPORARY_PREFIX))
      .map((entry) =>
        rm(path.join(directory, entry), { recursive: true, force: true })
      )
  )
}
