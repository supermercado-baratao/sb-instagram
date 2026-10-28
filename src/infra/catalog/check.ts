import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  CATALOG_DATA_EXTENSION,
  CATALOG_IMAGE_EXTENSION,
  type CatalogCodes,
  type CatalogError,
  type CatalogProduct,
  checkCatalogCodes,
  checkCatalogImage,
  checkCatalogProduct,
  checkEanFileNames,
  checkNoEanFileNames,
  getCatalogProductCodes
} from '@/domain/catalog'
import { eanDirectory, noEanDirectory } from '@/infra/catalog/directory'
import { readCatalogImage } from '@/infra/catalog/image'

type FileCheck = {
  messages: string[]
  codes?: CatalogCodes
}

const checkProductFile = async (file: string): Promise<FileCheck> => {
  const ean = path.basename(file, CATALOG_DATA_EXTENSION)
  let data: unknown
  try {
    data = JSON.parse(await readFile(file, 'utf8'))
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

const checkImageFile = async (file: string): Promise<FileCheck> => {
  try {
    return {
      messages: checkCatalogImage(await readCatalogImage(await readFile(file)))
    }
  } catch {
    return { messages: ['O arquivo não é uma imagem válida'] }
  }
}

const checkFileContent = async (file: string): Promise<FileCheck> => {
  if (file.endsWith(CATALOG_DATA_EXTENSION)) return checkProductFile(file)
  if (file.endsWith(CATALOG_IMAGE_EXTENSION)) return checkImageFile(file)
  return { messages: [] }
}

const checkFolder = async (
  directory: string,
  checkFileNames: (fileNames: string[]) => CatalogError[]
) => {
  const fileNames = await readdir(directory)

  const checks = await Promise.all(
    fileNames.map(async (fileName) => ({
      fileName,
      ...(await checkFileContent(path.join(directory, fileName)))
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

export const checkCatalog = async (): Promise<CatalogError[]> => {
  const errors = await Promise.all([
    checkFolder(eanDirectory, checkEanFileNames),
    checkFolder(noEanDirectory, checkNoEanFileNames)
  ])
  return errors.flat()
}
