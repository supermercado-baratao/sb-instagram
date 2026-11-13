import sharp from 'sharp'

export type CatalogImage = {
  format: string | undefined
  width: number
  height: number
  bytes: number
  cornerAlphas: number[]
  transparentBorderShare: number
}

export type ImageFrame = {
  side: number
  width: number
  height: number
  left: number
  top: number
}

// An editor or background removal tool often leaves a faint, invisible residue of the background
const NEARLY_TRANSPARENT_ALPHA = 8

export const getTransparentShare = (alphas: readonly number[]) =>
  alphas.length === 0
    ? 0
    : alphas.filter((alpha) => alpha <= NEARLY_TRANSPARENT_ALPHA).length /
      alphas.length

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

const transparent = { r: 0, g: 0, b: 0, alpha: 0 }

// Trims the transparent border, then places the product in the frame the given layout computes
export const frameImage = async (
  buffer: Buffer,
  getFrame: (content: { width: number; height: number }) => ImageFrame
) => {
  const { data: trimmed, info } = await sharp(buffer)
    .rotate()
    .ensureAlpha()
    .trim()
    .toBuffer({ resolveWithObject: true })

  const frame = getFrame(info)
  return (
    sharp(trimmed)
      .resize(frame.width, frame.height)
      .extend({
        top: frame.top,
        bottom: frame.side - frame.height - frame.top,
        left: frame.left,
        right: frame.side - frame.width - frame.left,
        background: transparent
      })
      // Lossless on purpose: palette quantization bands gradients and blurs small label text.
      // Adaptive filtering makes photos about 13% smaller at no quality cost
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer()
  )
}
