import sharp from 'sharp'

import { getCatalogImageLayout } from '@/domain/catalog'

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
