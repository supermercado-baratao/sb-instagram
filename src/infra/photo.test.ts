// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, onTestFinished, test } from 'vitest'

import {
  copyEanImage,
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
  test('copies the chosen image under the given name', async () => {
    const { photos, noEan } = await setup()
    await writeFile(path.join(noEan, 'alcatra.png'), 'image')

    await copyNoEanImage('alcatra', '2001.png', { photos, noEan })

    expect(await readFile(path.join(photos, '2001.png'), 'utf8')).toBe('image')
  })
})

describe('copyEanImage', () => {
  test('copies the catalog image and says when there is none', async () => {
    const { photos, ean } = await setup()
    await writeFile(path.join(ean, `${EAN}.png`), 'image')

    expect(await copyEanImage(EAN, `${EAN}.png`, { photos, ean })).toBe(true)
    expect(await readFile(path.join(photos, `${EAN}.png`), 'utf8')).toBe(
      'image'
    )
    expect(await copyEanImage('7891000053508', 'x.png', { photos, ean })).toBe(
      false
    )
    expect(await copyEanImage('../ean', 'x.png', { photos, ean })).toBe(false)
  })
})

describe('findPhotoFile', () => {
  test('finds a photo of the store', async () => {
    const { photos } = await setup()
    await mkdir(photos)
    await writeFile(path.join(photos, `${EAN}.png`), '')

    expect(await findPhotoFile(`${EAN}.png`, { photos })).toBe(
      path.join(photos, `${EAN}.png`)
    )
  })

  test('returns nothing for a missing or invalid name', async () => {
    const { photos } = await setup()

    expect(await findPhotoFile(`${EAN}.png`, { photos })).toBe(undefined)
    expect(await findPhotoFile('../secret.png', { photos })).toBe(undefined)
  })
})
