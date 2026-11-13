// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, onTestFinished, test } from 'vitest'

import { copyIntoPhotos, readPhoto, savePhoto } from './photo'

const EAN = '7891000100103'

const setup = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'photo-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))

  const photos = path.join(directory, 'photos')
  const ean = path.join(directory, 'ean')
  const noEan = path.join(directory, 'no-ean')
  await mkdir(ean)
  await mkdir(noEan)

  return { photos, ean, noEan }
}

const createJpeg = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: '#ff0000' }
  })
    .jpeg()
    .toBuffer()

describe('savePhoto', () => {
  test('shrinks a large photo into a PNG with the given name', async () => {
    const { photos } = await setup()

    await savePhoto('1234.png', await createJpeg(1600, 1200), { photos })

    const metadata = await sharp(path.join(photos, '1234.png')).metadata()
    expect(metadata).toMatchObject({ format: 'png', width: 800, height: 600 })
  })

  test('never enlarges a small photo', async () => {
    const { photos } = await setup()

    await savePhoto('1234.png', await createJpeg(300, 200), { photos })

    const metadata = await sharp(path.join(photos, '1234.png')).metadata()
    expect(metadata).toMatchObject({ width: 300, height: 200 })
  })

  test('refuses a name that could leave the photos folder', async () => {
    const { photos } = await setup()

    await expect(
      savePhoto('../1234.png', await createJpeg(300, 200), { photos })
    ).rejects.toThrow()
  })
})

describe('copyIntoPhotos', () => {
  test('copies a file under the given name', async () => {
    const { photos, noEan } = await setup()
    await writeFile(path.join(noEan, 'alcatra.png'), 'image')

    await copyIntoPhotos(path.join(noEan, 'alcatra.png'), '2001.png', {
      photos
    })

    expect(await readFile(path.join(photos, '2001.png'), 'utf8')).toBe('image')
  })

  test('refuses a name that could leave the photos folder', async () => {
    const { photos, noEan } = await setup()

    await expect(
      copyIntoPhotos(path.join(noEan, 'alcatra.png'), '../2001.png', {
        photos
      })
    ).rejects.toThrow()
  })
})

describe('readPhoto', () => {
  test('reads a photo of the store', async () => {
    const { photos } = await setup()
    await mkdir(photos)
    await writeFile(path.join(photos, `${EAN}.png`), 'image')

    expect(await readPhoto(`${EAN}.png`, { photos })).toEqual(
      Buffer.from('image')
    )
  })

  test('returns nothing for a missing or invalid name', async () => {
    const { photos } = await setup()

    expect(await readPhoto(`${EAN}.png`, { photos })).toBe(undefined)
    expect(await readPhoto('../secret.png', { photos })).toBe(undefined)
  })
})
