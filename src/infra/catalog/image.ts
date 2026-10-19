import sharp from 'sharp'

import type { CatalogImage } from '@/domain/catalog'

export const readCatalogImage = async (
  buffer: Buffer
): Promise<CatalogImage> => {
  const { format, width, height } = await sharp(buffer).metadata()
  const { data } = await sharp(buffer)
    .ensureAlpha()
    .extractChannel('alpha')
    .raw()
    .toBuffer({ resolveWithObject: true })

  const corners = [0, width - 1, (height - 1) * width, height * width - 1]

  return {
    format,
    width,
    height,
    bytes: buffer.length,
    cornerAlphas: corners.map((index) => data[index])
  }
}
