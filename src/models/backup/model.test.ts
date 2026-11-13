// @vitest-environment node
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { unzipSync, zipSync } from 'fflate'
import { describe, expect, onTestFinished, test } from 'vitest'

import { migrationsFolder } from '@/infra/database/file'
import { relations } from '@/infra/database/relations'
import { brand, generations, products } from '@/infra/database/schema'
import { AppError } from '@/infra/errors'

import { createBackupManifest } from './backup'
import { backupModel } from './model'

const temporaryFolder = async (prefix: string) => {
  const folder = await mkdtemp(path.join(tmpdir(), prefix))
  onTestFinished(() => rm(folder, { recursive: true, force: true }))
  return folder
}

const setup = async (name: string) => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const database = drizzle({ client: sqlite, relations })
  migrate(database, { migrationsFolder })
  database
    .insert(brand)
    .values({ id: 1, name, slogan: '', instagram: '' })
    .run()
  const dataDirectory = await temporaryFolder('backup-')
  return { database, dataDirectory }
}

const addGeneration = async (
  { database, dataDirectory }: Awaited<ReturnType<typeof setup>>,
  number: number,
  content: string
) => {
  const { id } = database
    .insert(generations)
    .values({ number, offerExport: '{}', pageCount: 1 })
    .returning({ id: generations.id })
    .get()
  const folder = path.join(dataDirectory, 'generations', String(id))
  await mkdir(folder, { recursive: true })
  await writeFile(path.join(folder, 'pagina-1.png'), content)
  return id
}

const collect = async (archive: AsyncIterable<Uint8Array>) => {
  const chunks: Uint8Array[] = await Array.fromAsync(archive)
  return Buffer.concat(chunks)
}

async function* inChunks(data: Uint8Array, size = 1000) {
  for (let start = 0; start < data.length; start += size) {
    yield data.subarray(start, start + size)
  }
}

const createDatabaseFile = async (
  folder: string,
  fill: (sqlite: Database.Database) => void = () => {},
  migrations = migrationsFolder
) => {
  const file = path.join(folder, 'source.sqlite')
  const sqlite = new Database(file)
  migrate(drizzle({ client: sqlite }), { migrationsFolder: migrations })
  fill(sqlite)
  sqlite.close()
  return readFile(file)
}

const encode = (text: string) => new TextEncoder().encode(text)

const encodeManifest = () => {
  const manifest = createBackupManifest(new Date())
  return encode(JSON.stringify(manifest))
}

const sortNames = (names: string[]) =>
  names.toSorted((a, b) => a.localeCompare(b))

describe('backup', () => {
  test('restores the tables and files of another instance', async () => {
    const source = await setup('Mercado Bom Preço')
    source.database
      .insert(products)
      .values({
        id: '0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d',
        description: 'Arroz'
      })
      .run()
    await mkdir(path.join(source.dataDirectory, 'photos'))
    await writeFile(
      path.join(source.dataDirectory, 'photos', '7891000100103.png'),
      'photo'
    )
    await writeFile(path.join(source.dataDirectory, 'logo.png'), 'logo')
    await addGeneration(source, 1, 'source page')
    await mkdir(path.join(source.dataDirectory, 'generations', '.tmp-x'))

    const archive = await collect(
      backupModel.createArchive(source.database, {
        dataDirectory: source.dataDirectory
      })
    )
    const names = Object.keys(unzipSync(archive))
    expect(sortNames(names)).toEqual([
      'backup.json',
      'database.sqlite',
      'files/generations/1/pagina-1.png',
      'files/logo.png',
      'files/photos/7891000100103.png'
    ])
    expect(await readdir(source.dataDirectory)).not.toContainEqual(
      expect.stringMatching(/^\.backup-/)
    )

    const target = await setup('Outro Mercado')
    await addGeneration(target, 1, 'target page 1')
    await addGeneration(target, 2, 'target page 2')
    await mkdir(path.join(target.dataDirectory, 'photos'))
    await writeFile(path.join(target.dataDirectory, 'photos', 'old.png'), 'old')
    await writeFile(path.join(target.dataDirectory, 'notas.txt'), 'kept')

    const prepared = await backupModel.prepare(inChunks(archive), {
      dataDirectory: target.dataDirectory
    })
    expect(prepared.summary).toEqual(backupModel.summarize(source.database))
    expect(backupModel.summarize(target.database).brandName).toBe(
      'Outro Mercado'
    )

    await backupModel.apply(target.database, prepared.token, {
      dataDirectory: target.dataDirectory
    })

    expect(backupModel.summarize(target.database)).toEqual(prepared.summary)
    const [generation] = target.database.select().from(generations).all()
    expect(generation.id).toBe(3)
    expect(
      await readFile(
        path.join(target.dataDirectory, 'generations', '3', 'pagina-1.png'),
        'utf8'
      )
    ).toBe('source page')
    expect(await readdir(path.join(target.dataDirectory, 'photos'))).toEqual([
      '7891000100103.png'
    ])
    expect(
      await readFile(path.join(target.dataDirectory, 'logo.png'), 'utf8')
    ).toBe('logo')
    const entries = await readdir(target.dataDirectory)
    expect(sortNames(entries)).toEqual([
      'generations',
      'logo.png',
      'notas.txt',
      'photos'
    ])

    const id = await addGeneration(target, 2, 'new page')
    expect(id).toBe(4)
  })

  test('refuses a file that is not a backup', async () => {
    const { dataDirectory } = await setup('Mercado')
    const notZip = inChunks(encode('not a zip'))
    await expect(
      backupModel.prepare(notZip, { dataDirectory })
    ).rejects.toThrow(AppError)
    const notBackup = inChunks(zipSync({ 'notes.txt': encodeManifest() }))
    await expect(
      backupModel.prepare(notBackup, { dataDirectory })
    ).rejects.toThrow(AppError)
    expect(await readdir(dataDirectory)).toEqual([])
  })

  test('refuses a file name outside the data entries', async () => {
    const { dataDirectory } = await setup('Mercado')
    const folder = await temporaryFolder('backup-source-')
    const archive = zipSync({
      'backup.json': encodeManifest(),
      'database.sqlite': await createDatabaseFile(folder),
      'files/photos/../../escaped.txt': new TextEncoder().encode('x')
    })
    await expect(
      backupModel.prepare(inChunks(archive), { dataDirectory })
    ).rejects.toThrow(AppError)
    expect(await readdir(dataDirectory)).toEqual([])
    expect(await readdir(path.dirname(dataDirectory))).not.toContain(
      'escaped.txt'
    )
  })

  test('refuses a backup from a newer version of the app', async () => {
    const { dataDirectory } = await setup('Mercado')
    const folder = await temporaryFolder('backup-source-')
    const archive = zipSync({
      'backup.json': encodeManifest(),
      'database.sqlite': await createDatabaseFile(folder, (sqlite) =>
        sqlite
          .prepare(
            `INSERT INTO __drizzle_migrations (hash, name) VALUES (?, ?)`
          )
          .run('hash', '29991231000000_future')
      )
    })
    await expect(
      backupModel.prepare(inChunks(archive), { dataDirectory })
    ).rejects.toThrow('versão mais nova')
  })

  test('brings a backup from an older version up to date', async () => {
    const { database, dataDirectory } = await setup('Mercado')
    const folder = await temporaryFolder('backup-source-')
    const older = path.join(folder, 'migrations')
    const migrations = sortNames(await readdir(migrationsFolder))
    const before = migrations.slice(0, -1)
    for (const migration of before) {
      await cp(
        path.join(migrationsFolder, migration),
        path.join(older, migration),
        { recursive: true }
      )
    }
    const archive = zipSync({
      'backup.json': encodeManifest(),
      'database.sqlite': await createDatabaseFile(folder, () => {}, older)
    })

    const prepared = await backupModel.prepare(inChunks(archive), {
      dataDirectory
    })
    await backupModel.apply(database, prepared.token, { dataDirectory })
    expect(backupModel.summarize(database).brandName).toBeNull()
  })

  test('discards a backup the store did not confirm', async () => {
    const source = await setup('Mercado')
    const archive = await collect(
      backupModel.createArchive(source.database, {
        dataDirectory: source.dataDirectory
      })
    )
    const target = await setup('Outro Mercado')
    const prepared = await backupModel.prepare(inChunks(archive), {
      dataDirectory: target.dataDirectory
    })
    await backupModel.discard(prepared.token, {
      dataDirectory: target.dataDirectory
    })
    expect(await readdir(target.dataDirectory)).toEqual([])
    await expect(
      backupModel.apply(target.database, prepared.token, {
        dataDirectory: target.dataDirectory
      })
    ).rejects.toThrow(AppError)
    expect(backupModel.summarize(target.database).brandName).toBe(
      'Outro Mercado'
    )
  })

  test('removes the folders a restart interrupted', async () => {
    const { dataDirectory } = await setup('Mercado')
    await mkdir(path.join(dataDirectory, '.backup-1'))
    await mkdir(path.join(dataDirectory, '.restore-1'))
    await mkdir(path.join(dataDirectory, 'photos'))
    await backupModel.removeUnfinished(dataDirectory)
    expect(await readdir(dataDirectory)).toEqual(['photos'])
  })
})
