import sharp from 'sharp'
import { describe, expect, test } from 'vitest'

import { getTransparentShare, readCatalogImage } from './image'

const transparent = { r: 0, g: 0, b: 0, alpha: 0 }

describe('readCatalogImage', () => {
  test('reads the format, size, the alpha of the four corners and the transparent border', async () => {
    const opaquePixel = await sharp({
      create: { width: 1, height: 1, channels: 4, background: '#f00' }
    })
      .png()
      .toBuffer()
    const buffer = await sharp({
      create: { width: 4, height: 3, channels: 4, background: transparent }
    })
      .composite([{ input: opaquePixel, left: 3, top: 2 }])
      .png()
      .toBuffer()

    expect(await readCatalogImage(buffer)).toEqual({
      format: 'png',
      width: 4,
      height: 3,
      bytes: buffer.length,
      cornerAlphas: [0, 0, 0, 255],
      // 1 of the 10 border pixels is opaque
      transparentBorderShare: 0.9
    })
  })

  test('treats an image without an alpha channel as opaque', async () => {
    const buffer = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#fff' }
    })
      .jpeg()
      .toBuffer()

    const { cornerAlphas, transparentBorderShare } =
      await readCatalogImage(buffer)

    expect(cornerAlphas).toEqual([255, 255, 255, 255])
    expect(transparentBorderShare).toBe(0)
  })
})

describe('getTransparentShare', () => {
  test('counts the faint residue a background removal leaves as transparent', () => {
    expect(getTransparentShare([0, 8, 9, 255])).toBe(0.5)
  })

  test('returns zero for no pixels', () => {
    expect(getTransparentShare([])).toBe(0)
  })
})
