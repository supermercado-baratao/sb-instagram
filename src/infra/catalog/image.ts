import sharp from 'sharp'

import { type CatalogImage, getTransparentShare } from '@/domain/catalog'

const getBorderIndexes = (width: number, height: number) => {
  const indexes = new Set<number>()
  for (let x = 0; x < width; x++) {
    indexes.add(x)
    indexes.add((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    indexes.add(y * width)
    indexes.add(y * width + width - 1)
  }
  return [...indexes]
}

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
    cornerAlphas: corners.map((index) => data[index]),
    transparentBorderShare: getTransparentShare(
      getBorderIndexes(width, height).map((index) => data[index])
    )
  }
}
