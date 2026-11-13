import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, onTestFinished, test } from 'vitest'

import { readCatalogImage } from '@/infra/catalog/image'

import { checkCatalogImage, CUT_OUT_ERROR } from './catalog'
import { catalogModel } from './model'

const transparent = { r: 0, g: 0, b: 0, alpha: 0 }

const createImage = async (product: {
  width: number
  height: number
  left: number
  top: number
}) => {
  const opaque = await sharp({
    create: {
      width: product.width,
      height: product.height,
      channels: 4,
      background: '#c0392b'
    }
  })
    .png()
    .toBuffer()

  return sharp({
    create: { width: 3000, height: 2000, channels: 4, background: transparent }
  })
    .composite([{ input: opaque, left: product.left, top: product.top }])
    .png()
    .toBuffer()
}

describe('optimizeImage', () => {
  test('frames a large product that fills its corners into a valid catalog image', async () => {
    const buffer = await createImage({
      width: 2000,
      height: 1600,
      left: 700,
      top: 300
    })

    const image = await readCatalogImage(
      await catalogModel.optimizeImage(buffer)
    )

    expect(image).toMatchObject({ format: 'png', width: 800, height: 800 })
    expect(checkCatalogImage(image)).toEqual([])
  })

  test('crops the transparent area around the product before framing it', async () => {
    const buffer = await createImage({
      width: 900,
      height: 900,
      left: 100,
      top: 100
    })

    const { data, info } = await sharp(await catalogModel.optimizeImage(buffer))
      .extractChannel('alpha')
      .raw()
      .toBuffer({ resolveWithObject: true })

    expect(info.width).toBe(800)
    expect(data[40 * info.width + 40]).toBe(255)
    expect(data[39 * info.width + 39]).toBe(0)
  })
})

describe('prepareImage', () => {
  test('frames a product trimmed so close that it covers the corners', async () => {
    const buffer = await createImage({
      width: 3000,
      height: 1000,
      left: 0,
      top: 0
    })

    const { image, errors } = await catalogModel.prepareImage(buffer)

    expect(errors).toEqual([])
    expect(checkCatalogImage(await readCatalogImage(image!))).toEqual([])
  })

  test('frames a cut-out with a faint residue of the background in a corner', async () => {
    const residue = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 4 / 255 }
      }
    })
      .png()
      .toBuffer()
    const buffer = await sharp(
      await createImage({ width: 900, height: 900, left: 100, top: 100 })
    )
      .composite([{ input: residue, left: 0, top: 0 }])
      .png()
      .toBuffer()

    const { image, errors } = await catalogModel.prepareImage(buffer)

    expect(errors).toEqual([])
    expect(checkCatalogImage(await readCatalogImage(image!))).toEqual([])
  })

  test('refuses a photo with an opaque background', async () => {
    const buffer = await sharp({
      create: { width: 1000, height: 1000, channels: 3, background: '#fff' }
    })
      .png()
      .toBuffer()

    expect(await catalogModel.prepareImage(buffer)).toEqual({
      image: undefined,
      errors: [CUT_OUT_ERROR]
    })
  })
})

const createFolder = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'catalog-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))
  return directory
}

describe('listNoEanImages', () => {
  test('lists the valid image names in alphabetical order', async () => {
    const noEan = await createFolder()
    for (const fileName of [
      'picanha-bovina.png',
      'alcatra.png',
      '.gitkeep',
      'Banana.png',
      'notes.txt'
    ]) {
      await writeFile(path.join(noEan, fileName), '')
    }

    expect(await catalogModel.listNoEanImages(noEan)).toEqual([
      'alcatra',
      'picanha-bovina'
    ])
  })
})

describe('readNoEanImage', () => {
  test('reads an image and refuses a name that could leave the folder', async () => {
    const noEan = await createFolder()
    await writeFile(path.join(noEan, 'alcatra.png'), 'image')

    expect(await catalogModel.readNoEanImage('alcatra', noEan)).toEqual(
      Buffer.from('image')
    )
    expect(await catalogModel.readNoEanImage('../ean/alcatra', noEan)).toBe(
      undefined
    )
  })
})

describe('readEanImage', () => {
  test('reads the image of an EAN and nothing else', async () => {
    const ean = await createFolder()
    await writeFile(path.join(ean, '7891000100103.png'), 'image')

    expect(await catalogModel.readEanImage('7891000100103', ean)).toEqual(
      Buffer.from('image')
    )
    expect(await catalogModel.readEanImage('7891000053508', ean)).toBe(
      undefined
    )
    expect(await catalogModel.readEanImage('../ean', ean)).toBe(undefined)
  })
})
