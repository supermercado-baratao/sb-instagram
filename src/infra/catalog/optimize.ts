import sharp from 'sharp'

import {
  checkCatalogImage,
  getCatalogImageLayout,
  hasTransparentBackground,
  TRANSPARENT_BACKGROUND_ERROR
} from '@/domain/catalog'
import { readCatalogImage } from '@/infra/catalog/image'

const transparent = { r: 0, g: 0, b: 0, alpha: 0 }

export const optimizeCatalogImage = async (buffer: Buffer) => {
  const { data: trimmed, info } = await sharp(buffer)
    .rotate()
    .ensureAlpha()
    .trim()
    .toBuffer({ resolveWithObject: true })

  const layout = getCatalogImageLayout(info)
  return (
    sharp(trimmed)
      .resize(layout.width, layout.height)
      .extend({
        top: layout.top,
        bottom: layout.side - layout.height - layout.top,
        left: layout.left,
        right: layout.side - layout.width - layout.left,
        background: transparent
      })
      // Lossless on purpose: palette quantization bands gradients and blurs small label text.
      // Adaptive filtering makes photos about 13% smaller at no quality cost
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer()
  )
}

export type PreparedCatalogImage = {
  image: Buffer | undefined
  errors: string[]
}

// An image that already passes is returned as is, so it isn't re-encoded every time
export const prepareCatalogImage = async (
  original: Buffer
): Promise<PreparedCatalogImage> => {
  const originalImage = await readCatalogImage(original)
  if (checkCatalogImage(originalImage).length === 0) {
    return { image: original, errors: [] }
  }

  // The margin added around the product makes the corners transparent, so a photo with a
  // background would pass the check once framed: it has to be rejected before that
  if (!hasTransparentBackground(originalImage)) {
    return { image: undefined, errors: [TRANSPARENT_BACKGROUND_ERROR] }
  }

  const optimized = await optimizeCatalogImage(original)
  return {
    image: optimized,
    errors: checkCatalogImage(await readCatalogImage(optimized))
  }
}
