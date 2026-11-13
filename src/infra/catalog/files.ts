import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  CATALOG_DATA_EXTENSION,
  CATALOG_IMAGE_EXTENSION
} from '@/constants/catalog'

import { eanDirectory, noEanDirectory } from './directory'

// Names may come from a request, so one that isn't a plain file name never leaves the folder
const getCatalogFile = (directory: string, base: string, extension: string) => {
  if (path.basename(base) !== base || base.startsWith('.')) {
    throw new Error(`Invalid catalog file name: ${base}`)
  }
  return path.join(directory, `${base}${extension}`)
}

const exists = async (file: string) => {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

export const listCatalogFileNames = (directory: string) => readdir(directory)

// The names without the extension, of the files that have it
export const listCatalogBaseNames = async (
  directory: string,
  extension: string
) => {
  const fileNames = await readdir(directory)
  return fileNames
    .filter((fileName) => fileName.endsWith(extension))
    .map((fileName) => fileName.slice(0, -extension.length))
}

export const readCatalogFile = (directory: string, fileName: string) =>
  readFile(getCatalogFile(directory, fileName, ''))

// Throws when the file is missing or isn't JSON
export const readCatalogData = async (
  ean: string,
  directory = eanDirectory
): Promise<unknown> =>
  JSON.parse(
    await readFile(
      getCatalogFile(directory, ean, CATALOG_DATA_EXTENSION),
      'utf8'
    )
  )

export const getEanImageFile = (ean: string, directory = eanDirectory) =>
  getCatalogFile(directory, ean, CATALOG_IMAGE_EXTENSION)

export const getNoEanImageFile = (name: string, directory = noEanDirectory) =>
  getCatalogFile(directory, name, CATALOG_IMAGE_EXTENSION)

export const findEanImageFile = async (
  ean: string,
  directory = eanDirectory
) => {
  const file = getEanImageFile(ean, directory)
  return (await exists(file)) ? file : undefined
}
