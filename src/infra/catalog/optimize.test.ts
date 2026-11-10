import sharp from 'sharp'
import { describe, expect, test } from 'vitest'

import { checkCatalogImage, CUT_OUT_ERROR } from '@/domain/catalog'

import { readCatalogImage } from './image'
import { optimizeCatalogImage, prepareCatalogImage } from './optimize'

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

describe('optimizeCatalogImage', () => {
  test('frames a large product that fills its corners into a valid catalog image', async () => {
    const buffer = await createImage({
      width: 2000,
      height: 1600,
      left: 700,
      top: 300
    })

    const image = await readCatalogImage(await optimizeCatalogImage(buffer))

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

    const { data, info } = await sharp(await optimizeCatalogImage(buffer))
      .extractChannel('alpha')
      .raw()
      .toBuffer({ resolveWithObject: true })

    expect(info.width).toBe(800)
    expect(data[40 * info.width + 40]).toBe(255)
    expect(data[39 * info.width + 39]).toBe(0)
  })
})

describe('prepareCatalogImage', () => {
  test('frames a product trimmed so close that it covers the corners', async () => {
    const buffer = await createImage({
      width: 3000,
      height: 1000,
      left: 0,
      top: 0
    })

    const { image, errors } = await prepareCatalogImage(buffer)

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

    const { image, errors } = await prepareCatalogImage(buffer)

    expect(errors).toEqual([])
    expect(checkCatalogImage(await readCatalogImage(image!))).toEqual([])
  })

  test('refuses a photo with an opaque background', async () => {
    const buffer = await sharp({
      create: { width: 1000, height: 1000, channels: 3, background: '#fff' }
    })
      .png()
      .toBuffer()

    expect(await prepareCatalogImage(buffer)).toEqual({
      image: undefined,
      errors: [CUT_OUT_ERROR]
    })
  })
})
