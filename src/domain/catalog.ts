import { isValidEan } from '@/domain/ean'

export type CatalogProduct = {
  name: string
  brand: string
  unit: string
  // The product's other EANs, for a photo that groups variations sold under different codes (#51)
  codes?: string[]
}

export type CatalogCodes = {
  ean: string
  codes: string[]
}

export type CatalogImage = {
  format: string | undefined
  width: number
  height: number
  bytes: number
  cornerAlphas: number[]
}

export type CatalogError = {
  file: string
  message: string
}

export const CATALOG_IMAGE_EXTENSION = '.png'
export const CATALOG_DATA_EXTENSION = '.json'

// The poster shows a photo at about 340 px at most (the 4-product layout), so 800 px keeps a 2x
// margin while every pixel still reaches the poster; files are lossless to keep labels legible
export const CATALOG_IMAGE_RULES = {
  format: 'png',
  minSide: 600,
  maxSide: 800,
  maxMegabytes: 1
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

const CATALOG_PRODUCT_FIELDS = ['name', 'brand', 'unit'] as const

const CATALOG_PRODUCT_KEYS: ReadonlySet<string> = new Set([
  ...CATALOG_PRODUCT_FIELDS,
  'codes'
])

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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const checkCodesField = (codes: unknown, ean: string): string[] => {
  if (!Array.isArray(codes) || codes.length === 0) {
    return ['O campo codes precisa ser uma lista não vazia de EANs']
  }

  const seen = new Set<string>()
  return codes.flatMap((code: unknown) => {
    if (typeof code !== 'string' || !isValidEan(code)) {
      return [`O código ${JSON.stringify(code)} em codes não é um EAN válido`]
    }
    if (code === ean) return [`O EAN ${code} em codes já é o nome do arquivo`]
    if (seen.has(code)) return [`O EAN ${code} se repete em codes`]
    seen.add(code)
    return []
  })
}

export const checkCatalogProduct = (data: unknown, ean: string): string[] => {
  if (!isPlainObject(data)) {
    return ['O JSON precisa ser um objeto com name, brand e unit']
  }

  const fieldErrors = CATALOG_PRODUCT_FIELDS.flatMap((field) => {
    const value = data[field]
    return typeof value === 'string' && value.trim() !== ''
      ? []
      : [`O campo ${field} precisa ser um texto não vazio`]
  })

  const codesErrors =
    data.codes === undefined ? [] : checkCodesField(data.codes, ean)

  const extraKeyErrors = Object.keys(data)
    .filter((key) => !CATALOG_PRODUCT_KEYS.has(key))
    .map((key) => `O campo ${key} não faz parte do esquema`)

  return [...fieldErrors, ...codesErrors, ...extraKeyErrors]
}

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

export const TRANSPARENT_BACKGROUND_ERROR =
  'O fundo da imagem precisa ser transparente (os quatro cantos com transparência total)'

// The poster card has a colored background, so a white background would show around the photo
export const hasTransparentBackground = (
  image: Pick<CatalogImage, 'cornerAlphas'>
) => image.cornerAlphas.every((alpha) => alpha === 0)

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
