// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, onTestFinished, test } from 'vitest'

import {
  copyNoEanImage,
  findPhotoFile,
  getNoEanImageFile,
  listNoEanImages,
  savePhoto
} from './photo'

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
  test('shrinks a large photo into a PNG named after the code', async () => {
    const { photos } = await setup()

    const photo = await savePhoto('1234', await createJpeg(1600, 1200), {
      photos
    })

    expect(photo).toBe('1234.png')
    const metadata = await sharp(path.join(photos, photo)).metadata()
    expect(metadata).toMatchObject({ format: 'png', width: 800, height: 600 })
  })

  test('never enlarges a small photo', async () => {
    const { photos } = await setup()

    await savePhoto('1234', await createJpeg(300, 200), { photos })

    const metadata = await sharp(path.join(photos, '1234.png')).metadata()
    expect(metadata).toMatchObject({ width: 300, height: 200 })
  })

  test('refuses a code that could leave the photos folder', async () => {
    const { photos } = await setup()

    await expect(
      savePhoto('../1234', await createJpeg(300, 200), { photos })
    ).rejects.toThrow()
  })
})

describe('listNoEanImages', () => {
  test('lists the valid image names in alphabetical order', async () => {
    const { noEan } = await setup()
    for (const fileName of [
      'picanha-bovina.png',
      'alcatra.png',
      '.gitkeep',
      'Banana.png',
      'notes.txt'
    ]) {
      await writeFile(path.join(noEan, fileName), '')
    }

    expect(await listNoEanImages(noEan)).toEqual(['alcatra', 'picanha-bovina'])
  })
})

describe('getNoEanImageFile', () => {
  test('rejects a name that could leave the catalog folder', () => {
    expect(getNoEanImageFile('../ean/alcatra')).toBe(undefined)
  })
})

describe('copyNoEanImage', () => {
  test('copies the chosen image renamed to the internal code', async () => {
    const { photos, noEan } = await setup()
    await writeFile(path.join(noEan, 'alcatra.png'), 'image')

    const photo = await copyNoEanImage('alcatra', '2001', { photos, noEan })

    expect(photo).toBe('2001.png')
    expect(await readFile(path.join(photos, photo), 'utf8')).toBe('image')
  })
})

describe('findPhotoFile', () => {
  test('prefers the store photo over the catalog image', async () => {
    const { photos, ean } = await setup()
    await mkdir(photos)
    await writeFile(path.join(photos, `${EAN}.png`), '')
    await writeFile(path.join(ean, `${EAN}.png`), '')

    expect(await findPhotoFile(EAN, { photos, ean })).toBe(
      path.join(photos, `${EAN}.png`)
    )
  })

  test('falls back to the catalog image', async () => {
    const { photos, ean } = await setup()
    await writeFile(path.join(ean, `${EAN}.png`), '')

    expect(await findPhotoFile(EAN, { photos, ean })).toBe(
      path.join(ean, `${EAN}.png`)
    )
  })

  test('returns nothing for an unknown or invalid code', async () => {
    const { photos, ean } = await setup()

    expect(await findPhotoFile(EAN, { photos, ean })).toBe(undefined)
    expect(await findPhotoFile('../secret', { photos, ean })).toBe(undefined)
  })
})
