import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  CATALOG_DATA_EXTENSION,
  CATALOG_IMAGE_EXTENSION,
  type CatalogError,
  checkCatalogImage,
  checkCatalogProduct,
  checkEanFileNames,
  checkNoEanFileNames
} from '@/domain/catalog'
import { eanDirectory, noEanDirectory } from '@/infra/catalog/directory'
import { readCatalogImage } from '@/infra/catalog/image'

const checkProductFile = async (file: string) => {
  try {
    return checkCatalogProduct(JSON.parse(await readFile(file, 'utf8')))
  } catch {
    return ['O arquivo não é um JSON válido']
  }
}

const checkImageFile = async (file: string) => {
  try {
    return checkCatalogImage(await readCatalogImage(await readFile(file)))
  } catch {
    return ['O arquivo não é uma imagem válida']
  }
}

const checkFileContent = (file: string) => {
  if (file.endsWith(CATALOG_DATA_EXTENSION)) return checkProductFile(file)
  if (file.endsWith(CATALOG_IMAGE_EXTENSION)) return checkImageFile(file)
  return []
}

const checkFolder = async (
  directory: string,
  checkFileNames: (fileNames: string[]) => CatalogError[]
) => {
  const fileNames = await readdir(directory)

  const contentErrors = await Promise.all(
    fileNames.map(async (fileName) => {
      const messages = await checkFileContent(path.join(directory, fileName))
      return messages.map((message) => ({ file: fileName, message }))
    })
  )

  return [...checkFileNames(fileNames), ...contentErrors.flat()]
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
