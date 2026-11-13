import { readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  CATALOG_DATA_EXTENSION,
  CATALOG_IMAGE_EXTENSION
} from '@/constants/catalog'
import { eanDirectory, noEanDirectory } from '@/infra/catalog/directory'
import {
  findEanImageFile,
  getNoEanImageFile,
  listCatalogBaseNames,
  listCatalogFileNames,
  readCatalogData,
  readCatalogFile
} from '@/infra/catalog/files'
import { frameImage, readCatalogImage } from '@/infra/catalog/image'
import { isValidEan } from '@/models/product/ean'

import {
  type CatalogCodes,
  type CatalogError,
  checkCatalogCodes,
  checkCatalogImage,
  checkEanFileNames,
  checkNoEanFileNames,
  CUT_OUT_ERROR,
  getCatalogImageLayout,
  getCatalogProductCodes,
  isCatalogDescriptionName,
  isCutOut
} from './catalog'
import {
  type CatalogProduct,
  checkCatalogProduct,
  getCatalogProductSchema
} from './schema'

// CI rejects an invalid catalog file, but a lookup must not break the form if one slips through
const readProduct = async (
  ean: string,
  directory = eanDirectory
): Promise<CatalogProduct | undefined> => {
  try {
    const result = getCatalogProductSchema(ean).safeParse(
      await readCatalogData(ean, directory)
    )
    return result.success ? result.data : undefined
  } catch {
    return undefined
  }
}

export type CatalogEntry = {
  ean: string
  product: CatalogProduct
}

const readEntries = async (
  directory = eanDirectory
): Promise<CatalogEntry[]> => {
  let eans: string[]
  try {
    eans = await listCatalogBaseNames(directory, CATALOG_DATA_EXTENSION)
  } catch {
    return []
  }

  const entries: CatalogEntry[] = []
  for (const ean of eans) {
    const product = await readProduct(ean, directory)
    if (product) entries.push({ ean, product })
  }
  return entries
}

// Every EAN of the catalog, file names and codes lists, mapped to the file that holds it
const readCodes = async (directory = eanDirectory) => {
  const owners = new Map<string, string>()
  const entries = await readEntries(directory)
  for (const { ean, product } of entries) {
    for (const code of getCatalogProductCodes(ean, product)) {
      if (!owners.has(code)) owners.set(code, ean)
    }
  }
  return owners
}

// The catalog only changes with a new image, so what is read from it lives as long as the process
const codeIndexes = new Map<string, Promise<Map<string, string>>>()
const entryLists = new Map<string, Promise<CatalogEntry[]>>()

const getCodeIndex = (directory: string) => {
  let index = codeIndexes.get(directory)
  if (!index) {
    index = readCodes(directory)
    codeIndexes.set(directory, index)
  }
  return index
}

const listEntries = (directory = eanDirectory) => {
  let entries = entryLists.get(directory)
  if (!entries) {
    entries = readEntries(directory)
    entryLists.set(directory, entries)
  }
  return entries
}

const findProduct = async (
  code: string,
  directory = eanDirectory
): Promise<CatalogEntry | undefined> => {
  if (!isValidEan(code)) return undefined

  const named = await readProduct(code, directory)
  if (named) return { ean: code, product: named }

  const index = await getCodeIndex(directory)
  const ean = index.get(code)
  if (ean === undefined) return undefined
  const product = await readProduct(ean, directory)
  return product && { ean, product }
}

const listNoEanImages = async (directory = noEanDirectory) => {
  const names = await listCatalogBaseNames(directory, CATALOG_IMAGE_EXTENSION)
  return names
    .filter((name) => isCatalogDescriptionName(name))
    .toSorted((a, b) => a.localeCompare(b))
}

const getNoEanImage = (name: string, directory = noEanDirectory) =>
  isCatalogDescriptionName(name)
    ? getNoEanImageFile(name, directory)
    : undefined

const findEanImage = (ean: string, directory = eanDirectory) =>
  isValidEan(ean) ? findEanImageFile(ean, directory) : undefined

const readImage = async (file: Promise<string | undefined> | undefined) => {
  const found = await file
  if (!found) return
  try {
    return await readFile(found)
  } catch {
    return
  }
}

const readEanImage = (ean: string, directory = eanDirectory) =>
  readImage(findEanImage(ean, directory))

const readNoEanImage = (name: string, directory = noEanDirectory) =>
  readImage(Promise.resolve(getNoEanImage(name, directory)))

type FileCheck = {
  messages: string[]
  codes?: CatalogCodes
}

const checkProductFile = async (
  directory: string,
  fileName: string
): Promise<FileCheck> => {
  const ean = path.basename(fileName, CATALOG_DATA_EXTENSION)
  let data: unknown
  try {
    const buffer = await readCatalogFile(directory, fileName)
    data = JSON.parse(buffer.toString())
  } catch {
    return { messages: ['O arquivo não é um JSON válido'] }
  }

  const messages = checkCatalogProduct(data, ean)
  return messages.length === 0
    ? {
        messages,
        codes: {
          ean,
          codes: getCatalogProductCodes(ean, data as CatalogProduct)
        }
      }
    : { messages }
}

const checkImageFile = async (
  directory: string,
  fileName: string
): Promise<FileCheck> => {
  try {
    const buffer = await readCatalogFile(directory, fileName)
    return { messages: checkCatalogImage(await readCatalogImage(buffer)) }
  } catch {
    return { messages: ['O arquivo não é uma imagem válida'] }
  }
}

const checkFileContent = async (
  directory: string,
  fileName: string
): Promise<FileCheck> => {
  if (fileName.endsWith(CATALOG_DATA_EXTENSION)) {
    return checkProductFile(directory, fileName)
  }
  if (fileName.endsWith(CATALOG_IMAGE_EXTENSION)) {
    return checkImageFile(directory, fileName)
  }
  return { messages: [] }
}

const checkFolder = async (
  directory: string,
  checkFileNames: (fileNames: string[]) => CatalogError[]
) => {
  const fileNames = await listCatalogFileNames(directory)

  const checks = await Promise.all(
    fileNames.map(async (fileName) => ({
      fileName,
      ...(await checkFileContent(directory, fileName))
    }))
  )
  const contentErrors = checks.flatMap(({ fileName, messages }) =>
    messages.map((message) => ({ file: fileName, message }))
  )

  const fileEans = new Set(
    fileNames.map((fileName) => fileName.slice(0, fileName.lastIndexOf('.')))
  )
  const codesErrors = checkCatalogCodes(
    fileEans,
    checks.flatMap(({ codes }) => (codes ? [codes] : []))
  )

  return [...checkFileNames(fileNames), ...contentErrors, ...codesErrors]
    .toSorted((a, b) => a.file.localeCompare(b.file))
    .map((error) => ({
      ...error,
      file: path.relative(process.cwd(), path.join(directory, error.file))
    }))
}

const check = async (): Promise<CatalogError[]> => {
  const errors = await Promise.all([
    checkFolder(eanDirectory, checkEanFileNames),
    checkFolder(noEanDirectory, checkNoEanFileNames)
  ])
  return errors.flat()
}

const optimizeImage = (buffer: Buffer) =>
  frameImage(buffer, getCatalogImageLayout)

export type PreparedCatalogImage = {
  image: Buffer | undefined
  errors: string[]
}

// An image that already passes is returned as is, so it isn't re-encoded every time
const prepareImage = async (
  original: Buffer
): Promise<PreparedCatalogImage> => {
  const originalImage = await readCatalogImage(original)
  if (checkCatalogImage(originalImage).length === 0) {
    return { image: original, errors: [] }
  }

  // The margin added around the product makes the corners transparent, so a photo with a
  // background would pass the check once framed: it has to be rejected before that
  if (!isCutOut(originalImage)) {
    return { image: undefined, errors: [CUT_OUT_ERROR] }
  }

  const optimized = await optimizeImage(original)
  return {
    image: optimized,
    errors: checkCatalogImage(await readCatalogImage(optimized))
  }
}

export const catalogModel = {
  findProduct,
  listEntries,
  readCodes,
  listNoEanImages,
  getNoEanImage,
  findEanImage,
  readEanImage,
  readNoEanImage,
  check,
  optimizeImage,
  prepareImage
}
