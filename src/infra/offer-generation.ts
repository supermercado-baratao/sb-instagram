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

import { and, desc, eq, max } from 'drizzle-orm'

import { getOfferExport } from '@/domain/offer-export'
import {
  GENERATION_PDF_FILE_NAME,
  getGenerationPageFileName,
  type OfferGeneration
} from '@/domain/offer-generation'
import type { Database } from '@/infra/database/relations'
import { offerGenerations } from '@/infra/database/schema'
import {
  generationsDirectory,
  getGenerationFolder
} from '@/infra/generations-directory'
import { findOffer } from '@/infra/offer'

export type OfferRenderer = {
  renderPage: (offerId: number, pageNumber: number) => Promise<Uint8Array>
  renderPdf: (offerId: number) => Promise<Uint8Array>
}

type GenerationOptions = { directory?: string }

const TEMPORARY_PREFIX = '.tmp-'

const generationColumns = {
  id: offerGenerations.id,
  offerId: offerGenerations.offerId,
  number: offerGenerations.number,
  pageCount: offerGenerations.pageCount,
  createdAt: offerGenerations.createdAt
}

export const listOfferGenerations = (
  database: Database,
  offerId: number
): OfferGeneration[] =>
  database
    .select(generationColumns)
    .from(offerGenerations)
    .where(eq(offerGenerations.offerId, offerId))
    .orderBy(desc(offerGenerations.number))
    .all()

export const findOfferGeneration = (
  database: Database,
  offerId: number,
  generationId: number
): OfferGeneration | undefined =>
  database
    .select(generationColumns)
    .from(offerGenerations)
    .where(
      and(
        eq(offerGenerations.id, generationId),
        eq(offerGenerations.offerId, offerId)
      )
    )
    .get()

export const findOfferGenerationExport = (
  database: Database,
  offerId: number,
  generationId: number
) =>
  database
    .select({ offerExport: offerGenerations.offerExport })
    .from(offerGenerations)
    .where(
      and(
        eq(offerGenerations.id, generationId),
        eq(offerGenerations.offerId, offerId)
      )
    )
    .get()?.offerExport

// The files are rendered into a temporary folder and only take the generation's id once its row
// exists, so a failure halfway never leaves a generation with missing files
export const createOfferGeneration = async (
  database: Database,
  offerId: number,
  renderer: OfferRenderer,
  { directory = generationsDirectory }: GenerationOptions = {}
): Promise<OfferGeneration | undefined> => {
  const offer = findOffer(database, offerId)
  if (!offer) return undefined

  const temporary = path.join(directory, `${TEMPORARY_PREFIX}${randomUUID()}`)
  await mkdir(temporary, { recursive: true })
  try {
    // One page at a time, so a long offer doesn't open a Chromium tab per page at once
    for (const index of offer.pages.keys()) {
      const pageNumber = index + 1
      await writeFile(
        path.join(temporary, getGenerationPageFileName(pageNumber)),
        await renderer.renderPage(offerId, pageNumber)
      )
    }
    await writeFile(
      path.join(temporary, GENERATION_PDF_FILE_NAME),
      await renderer.renderPdf(offerId)
    )

    const generation = database.transaction((transaction) => {
      const last = transaction
        .select({ number: max(offerGenerations.number) })
        .from(offerGenerations)
        .where(eq(offerGenerations.offerId, offerId))
        .get()
      return transaction
        .insert(offerGenerations)
        .values({
          offerId,
          number: (last?.number ?? 0) + 1,
          // Indented, since the store opens the file to read or edit it by hand
          offerExport: JSON.stringify(getOfferExport(offer), null, 2),
          pageCount: offer.pages.length
        })
        .returning(generationColumns)
        .get()
    })

    try {
      await rename(temporary, getGenerationFolder(generation.id, directory))
    } catch (error) {
      database
        .delete(offerGenerations)
        .where(eq(offerGenerations.id, generation.id))
        .run()
      throw error
    }
    return generation
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

export const deleteOfferGeneration = async (
  database: Database,
  offerId: number,
  generationId: number,
  { directory = generationsDirectory }: GenerationOptions = {}
) => {
  const { changes } = database
    .delete(offerGenerations)
    .where(
      and(
        eq(offerGenerations.id, generationId),
        eq(offerGenerations.offerId, offerId)
      )
    )
    .run()
  if (changes === 0) return false
  await rm(getGenerationFolder(generationId, directory), {
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
