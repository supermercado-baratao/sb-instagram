import {
  CATALOG_DATA_EXTENSION,
  CATALOG_IMAGE_EXTENSION,
  CATALOG_IMAGE_RULES
} from '@/constants/catalog'
import type { CatalogImage } from '@/infra/catalog/image'
import { isValidEan } from '@/models/product/ean'

import type { CatalogProduct } from './schema'

export type CatalogCodes = {
  ean: string
  codes: string[]
}

export type CatalogError = {
  file: string
  message: string
}

// A box-shaped product that touched the edges would make the corners opaque, failing the
// transparent background rule, so the product keeps this margin on every side
const CATALOG_IMAGE_MARGIN = 0.05

export type CatalogImageLayout = {
  side: number
  width: number
  height: number
  left: number
  top: number
}

// Never enlarges: a small photo upscaled would look blurry on the poster, so it keeps its size
// and fails the minimum side rule instead
export const getCatalogImageLayout = (content: {
  width: number
  height: number
}): CatalogImageLayout => {
  const contentRatio = 1 - 2 * CATALOG_IMAGE_MARGIN
  const longestSide = Math.max(content.width, content.height)
  const side = Math.min(
    Math.round(longestSide / contentRatio),
    CATALOG_IMAGE_RULES.maxSide
  )
  const scale = Math.min((side * contentRatio) / longestSide, 1)
  const width = Math.round(content.width * scale)
  const height = Math.round(content.height * scale)

  return {
    side,
    width,
    height,
    left: Math.floor((side - width) / 2),
    top: Math.floor((side - height) / 2)
  }
}

// Lets git keep the folders while the catalog has no product in them
const PLACEHOLDER_FILE = '.gitkeep'

// Requires a letter so a code can't be committed as if it were a description
const DESCRIPTION_NAME_PATTERN = /^(?=.*[a-z])[a-z\d]+(?:-[a-z\d]+)*$/

export const isCatalogDescriptionName = (name: string) =>
  DESCRIPTION_NAME_PATTERN.test(name)

const splitFileName = (fileName: string) => {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex <= 0
    ? { base: fileName, extension: '' }
    : {
        base: fileName.slice(0, dotIndex),
        extension: fileName.slice(dotIndex)
      }
}

export const checkEanFileNames = (fileNames: string[]): CatalogError[] => {
  const errors: CatalogError[] = []
  const extensionsByEan = new Map<string, Set<string>>()

  for (const fileName of fileNames) {
    if (fileName === PLACEHOLDER_FILE) continue

    const { base, extension } = splitFileName(fileName)

    if (
      extension !== CATALOG_IMAGE_EXTENSION &&
      extension !== CATALOG_DATA_EXTENSION
    ) {
      errors.push({
        file: fileName,
        message: `A extensão precisa ser ${CATALOG_IMAGE_EXTENSION} ou ${CATALOG_DATA_EXTENSION}`
      })
      continue
    }

    if (!isValidEan(base)) {
      errors.push({
        file: fileName,
        message:
          'O nome precisa ser um EAN válido (8, 12 ou 13 dígitos com o dígito verificador correto)'
      })
      continue
    }

    const extensions = extensionsByEan.get(base) ?? new Set()
    extensions.add(extension)
    extensionsByEan.set(base, extensions)
  }

  for (const [ean, extensions] of extensionsByEan) {
    for (const [present, missing] of [
      [CATALOG_IMAGE_EXTENSION, CATALOG_DATA_EXTENSION],
      [CATALOG_DATA_EXTENSION, CATALOG_IMAGE_EXTENSION]
    ]) {
      if (extensions.has(present) && !extensions.has(missing)) {
        errors.push({
          file: `${ean}${present}`,
          message: `Falta o arquivo ${ean}${missing}`
        })
      }
    }
  }

  return errors
}

export const checkNoEanFileNames = (fileNames: string[]): CatalogError[] =>
  fileNames.flatMap((fileName) => {
    if (fileName === PLACEHOLDER_FILE) return []

    const { base, extension } = splitFileName(fileName)

    if (extension !== CATALOG_IMAGE_EXTENSION) {
      return [
        {
          file: fileName,
          message: `A extensão precisa ser ${CATALOG_IMAGE_EXTENSION}`
        }
      ]
    }

    if (!isCatalogDescriptionName(base)) {
      return [
        {
          file: fileName,
          message:
            'O nome precisa ser a descrição do produto em letras minúsculas, sem acentos e com hífens no lugar dos espaços (ex.: picanha-bovina.png)'
        }
      ]
    }

    return []
  })

// A scan must find a single catalog product, so an EAN names one file or sits in one codes list
export const checkCatalogCodes = (
  fileEans: ReadonlySet<string>,
  products: CatalogCodes[]
): CatalogError[] => {
  const owners = new Map<string, string>()

  return products
    .toSorted((a, b) => a.ean.localeCompare(b.ean))
    .flatMap(({ ean, codes }) =>
      codes.flatMap((code) => {
        const file = `${ean}${CATALOG_DATA_EXTENSION}`
        if (code !== ean && fileEans.has(code)) {
          return [
            {
              file,
              message: `O EAN ${code} em codes já é o nome de outro produto do catálogo (${code}${CATALOG_DATA_EXTENSION})`
            }
          ]
        }

        const owner = owners.get(code)
        if (owner !== undefined && owner !== ean) {
          return [
            {
              file,
              message: `O EAN ${code} em codes já está em ${owner}${CATALOG_DATA_EXTENSION}`
            }
          ]
        }

        owners.set(code, ean)
        return []
      })
    )
}

export const getCatalogProductCodes = (
  ean: string,
  { codes = [] }: CatalogProduct
) => [ean, ...codes].toSorted((a, b) => a.localeCompare(b))

const TRANSPARENT_BACKGROUND_ERROR =
  'O fundo da imagem precisa ser transparente (os quatro cantos com transparência total)'

// The poster card has a colored background, so a white background would show around the photo
const hasTransparentBackground = (image: Pick<CatalogImage, 'cornerAlphas'>) =>
  image.cornerAlphas.every((alpha) => alpha === 0)

// A product trimmed close to the edges covers part of the border, even touching the corners, so a
// cut-out photo only needs part of its border transparent; a photo with a background has none (#109)
const CUT_OUT_MIN_BORDER_SHARE = 0.25

export const CUT_OUT_ERROR =
  'A foto não tem fundo transparente: o fundo é branco ou colorido, ou o xadrez cinza e branco faz parte da imagem. Recorte o produto num editor de imagem ou numa ferramenta de remoção de fundo'

// Checked on the original photo, before framing adds a transparent margin to every side
export const isCutOut = (image: Pick<CatalogImage, 'transparentBorderShare'>) =>
  image.transparentBorderShare >= CUT_OUT_MIN_BORDER_SHARE

export const checkCatalogImage = (image: CatalogImage): string[] => {
  const { format, minSide, maxSide, maxMegabytes } = CATALOG_IMAGE_RULES
  const errors: string[] = []

  if (image.format !== format) {
    errors.push(
      `A imagem precisa estar em PNG (formato atual: ${image.format ?? 'desconhecido'})`
    )
  }

  if (image.width !== image.height) {
    errors.push(
      `A imagem precisa ser quadrada (tamanho atual: ${image.width}x${image.height} px)`
    )
  } else if (image.width < minSide || image.width > maxSide) {
    errors.push(
      `O lado da imagem precisa ter de ${minSide} a ${maxSide} px (tamanho atual: ${image.width} px)`
    )
  }

  const megabytes = image.bytes / 1024 / 1024
  if (megabytes > maxMegabytes) {
    errors.push(
      `A imagem precisa ter até ${maxMegabytes} MB (tamanho atual: ${megabytes.toFixed(1)} MB)`
    )
  }

  if (!hasTransparentBackground(image)) {
    errors.push(TRANSPARENT_BACKGROUND_ERROR)
  }

  return errors
}
