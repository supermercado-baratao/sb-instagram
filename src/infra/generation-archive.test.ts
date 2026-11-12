// @vitest-environment node
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { strToU8, unzipSync, type Zippable, zipSync } from 'fflate'
import { describe, expect, onTestFinished, test } from 'vitest'

import { createOfferContent } from '@/domain/offer'
import { migrationsFolder } from '@/infra/database/file'
import { relations } from '@/infra/database/relations'

import {
  createGeneration,
  findGenerationExport,
  findGenerationTexts,
  listGenerations,
  type OfferRenderer
} from './generation'
import {
  createGenerationArchive,
  discardGenerationImport,
  GenerationArchiveError,
  importGeneration,
  prepareGenerationImport
} from './generation-archive'
import { saveOffer } from './offer'

const PNG = [137, 80, 78, 71, 13, 10, 26, 10]

const renderer: OfferRenderer = {
  renderPage: async (pageNumber) =>
    new Uint8Array([...PNG, ...strToU8(`page ${pageNumber}`)]),
  renderPdf: async () => strToU8('%PDF-1.7 pages')
}

const setup = async () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const database = drizzle({ client: sqlite, relations })
  migrate(database, { migrationsFolder })
  const directory = await mkdtemp(path.join(tmpdir(), 'generation-archive-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))
  return { database, directory }
}

const generate = async ({
  database,
  directory
}: Awaited<ReturnType<typeof setup>>) => {
  const content = createOfferContent('mercado')
  content.validUntil = '2026-11-12'
  content.pages.push(createOfferContent('mercado').pages[0])
  saveOffer(database, content)
  const generation = await createGeneration(database, renderer, { directory })
  if (!generation) throw new Error('No generation')
  return generation
}

const listSorted = async (folder: string) => {
  const entries = await readdir(folder)
  return entries.toSorted((a, b) => a.localeCompare(b))
}

const stream = async function* (data: Uint8Array) {
  yield data
}

const exportArchive = async (instance: Awaited<ReturnType<typeof setup>>) => {
  const generation = await generate(instance)
  const result = await createGenerationArchive(
    instance.database,
    generation.id,
    { directory: instance.directory }
  )
  if (!result) throw new Error('No archive')
  return { generation, archive: result.archive }
}

describe('createGenerationArchive', () => {
  test('holds the pages, the PDF, the texts and the manifest', async () => {
    const instance = await setup()
    const { generation, archive } = await exportArchive(instance)

    const files = unzipSync(archive)
    expect(Object.keys(files).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'geracao.json',
      'lista.md',
      'ofertas.json',
      'pagina-1.png',
      'pagina-2.png',
      'paginas.pdf',
      'roteiro.md'
    ])
    expect(JSON.parse(new TextDecoder().decode(files['geracao.json']))).toEqual(
      {
        format: 'sb-instagram-generation',
        version: 1,
        number: generation.number,
        pageCount: 2,
        createdAt: generation.createdAt.toISOString(),
        radioScript: generation.radioScript,
        pages: findGenerationTexts(instance.database, generation.id)?.pages
      }
    )
    expect(new TextDecoder().decode(files['ofertas.json'])).toBe(
      findGenerationExport(instance.database, generation.id)
    )
  })

  test('returns nothing for a generation that is gone or misses a file', async () => {
    const instance = await setup()
    const generation = await generate(instance)
    await rm(
      path.join(instance.directory, String(generation.id), 'paginas.pdf')
    )

    expect(
      await createGenerationArchive(instance.database, generation.id, {
        directory: instance.directory
      })
    ).toBeUndefined()
    expect(
      await createGenerationArchive(instance.database, 99, {
        directory: instance.directory
      })
    ).toBeUndefined()
  })
})

describe('prepareGenerationImport and importGeneration', () => {
  test('add the generation with the next number and its original date', async () => {
    const source = await setup()
    const { generation, archive } = await exportArchive(source)
    const target = await setup()
    await generate(target)
    await generate(target)

    const preview = await prepareGenerationImport(
      target.database,
      stream(archive),
      { directory: target.directory }
    )
    expect(preview).toMatchObject({
      number: generation.number,
      pageCount: 2,
      createdAt: generation.createdAt.toISOString(),
      validUntil: '2026-11-12',
      nextNumber: 3
    })
    expect(listGenerations(target.database)).toHaveLength(2)

    const imported = await importGeneration(target.database, preview.token, {
      directory: target.directory
    })

    expect(imported).toMatchObject({
      number: 3,
      pageCount: 2,
      validUntil: '2026-11-12',
      radioScript: generation.radioScript,
      createdAt: generation.createdAt
    })
    expect(findGenerationTexts(target.database, imported.id)).toEqual(
      findGenerationTexts(source.database, generation.id)
    )
    const folder = path.join(target.directory, String(imported.id))
    expect(await listSorted(folder)).toEqual([
      'pagina-1.png',
      'pagina-2.png',
      'paginas.pdf'
    ])
    expect(await readFile(path.join(folder, 'pagina-2.png'))).toEqual(
      Buffer.from(await renderer.renderPage(2))
    )
    // Only the generation folders stay, no temporary one
    expect(await listSorted(target.directory)).toEqual(['1', '2', '3'])
  })

  test('import the same file twice as two generations', async () => {
    const source = await setup()
    const { archive } = await exportArchive(source)
    const target = await setup()
    const options = { directory: target.directory }

    for (let time = 0; time < 2; time++) {
      const { token } = await prepareGenerationImport(
        target.database,
        stream(archive),
        options
      )
      await importGeneration(target.database, token, options)
    }

    expect(
      listGenerations(target.database).map(({ number }) => number)
    ).toEqual([2, 1])
  })

  test('discarding leaves the instance as it was', async () => {
    const source = await setup()
    const { archive } = await exportArchive(source)
    const target = await setup()
    const options = { directory: target.directory }

    const { token } = await prepareGenerationImport(
      target.database,
      stream(archive),
      options
    )
    await discardGenerationImport(token, options)

    expect(await readdir(target.directory)).toEqual([])
    await expect(
      importGeneration(target.database, token, options)
    ).rejects.toThrow('Envie o arquivo de novo')
    expect(listGenerations(target.database)).toEqual([])
  })

  test('removes the row when the folder cannot take the generation id', async () => {
    const source = await setup()
    const { archive } = await exportArchive(source)
    const target = await setup()
    const options = { directory: target.directory }
    const { token } = await prepareGenerationImport(
      target.database,
      stream(archive),
      options
    )
    // A file in the way of the first id's folder makes the rename fail
    await writeFile(path.join(target.directory, '1'), 'x')

    await expect(
      importGeneration(target.database, token, options)
    ).rejects.toThrow()
    expect(listGenerations(target.database)).toEqual([])
  })
})

const tamper = async (change: (files: Zippable) => void) => {
  const source = await setup()
  const { archive } = await exportArchive(source)
  const files: Zippable = unzipSync(archive)
  change(files)
  return zipSync(files)
}

const manifestWith = (files: Zippable, fields: Record<string, unknown>) => {
  const manifest = JSON.parse(
    new TextDecoder().decode(files['geracao.json'] as Uint8Array)
  ) as Record<string, unknown>
  files['geracao.json'] = strToU8(JSON.stringify({ ...manifest, ...fields }))
}

describe('prepareGenerationImport refuses', () => {
  test.each<[string, (files: Zippable) => void, RegExp]>([
    [
      'a missing page',
      (files) => delete files['pagina-2.png'],
      /não é uma oferta do histórico/
    ],
    [
      'an extra page',
      (files) => (files['pagina-3.png'] = files['pagina-1.png']),
      /não é uma oferta do histórico/
    ],
    [
      'a page that is not a PNG',
      (files) => (files['pagina-1.png'] = strToU8('not png')),
      /não é uma oferta do histórico/
    ],
    [
      'a PDF that is not a PDF',
      (files) => (files['paginas.pdf'] = strToU8('nope')),
      /não é uma oferta do histórico/
    ],
    [
      'a missing manifest',
      (files) => delete files['geracao.json'],
      /não é uma oferta do histórico/
    ],
    [
      'a broken offer export',
      (files) => (files['ofertas.json'] = strToU8('{')),
      /não é uma oferta do histórico/
    ],
    [
      'an unknown entry',
      (files) => (files['notas.txt'] = strToU8('oi')),
      /não é uma oferta do histórico/
    ],
    [
      'an entry outside the folder',
      (files) => (files['../pagina-1.png'] = files['pagina-1.png']),
      /não é uma oferta do histórico/
    ],
    [
      'a newer version',
      (files) => manifestWith(files, { version: 2 }),
      /versão mais nova/
    ]
  ])('%s', async (_label, change, message) => {
    const archive = await tamper(change)
    const target = await setup()

    const result = prepareGenerationImport(target.database, stream(archive), {
      directory: target.directory
    })

    await expect(result).rejects.toThrow(GenerationArchiveError)
    await expect(result).rejects.toThrow(message)
    expect(await readdir(target.directory)).toEqual([])
  })

  test('a file that is not a ZIP', async () => {
    const target = await setup()
    const archive = stream(strToU8('not a zip'))
    await expect(
      prepareGenerationImport(target.database, archive, {
        directory: target.directory
      })
    ).rejects.toThrow(/não é uma oferta do histórico/)
    expect(await readdir(target.directory)).toEqual([])
  })
})
