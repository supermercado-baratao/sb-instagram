import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  CATALOG_DATA_EXTENSION,
  CATALOG_IMAGE_EXTENSION,
  type CatalogProduct,
  checkCatalogProduct,
  getCatalogProductCodes
} from '@/domain/catalog'
import { eanDirectory } from '@/infra/catalog/directory'

export const getCatalogImageFile = (ean: string, directory = eanDirectory) =>
  path.join(directory, `${ean}${CATALOG_IMAGE_EXTENSION}`)

// CI rejects an invalid catalog file, but a lookup must not break the form if one slips through
export const readCatalogProduct = async (
  ean: string,
  directory = eanDirectory
): Promise<CatalogProduct | undefined> => {
  try {
    const data: unknown = JSON.parse(
      await readFile(
        path.join(directory, `${ean}${CATALOG_DATA_EXTENSION}`),
        'utf8'
      )
    )
    return checkCatalogProduct(data, ean).length === 0
      ? (data as CatalogProduct)
      : undefined
  } catch {
    return undefined
  }
}

// Every EAN of the catalog, file names and codes lists, mapped to the file that holds it
export const readCatalogCodes = async (directory = eanDirectory) => {
  const owners = new Map<string, string>()
  let fileNames: string[]
  try {
    fileNames = await readdir(directory)
  } catch {
    return owners
  }

  const eans = fileNames
    .filter((fileName) => fileName.endsWith(CATALOG_DATA_EXTENSION))
    .map((fileName) => fileName.slice(0, -CATALOG_DATA_EXTENSION.length))

  for (const ean of eans) {
    const product = await readCatalogProduct(ean, directory)
    if (!product) continue
    for (const code of getCatalogProductCodes(ean, product)) {
      if (!owners.has(code)) owners.set(code, ean)
    }
  }
  return owners
}

// The catalog only changes with a new image, so the index lives as long as the process
const codeIndexes = new Map<string, Promise<Map<string, string>>>()

const getCodeIndex = (directory: string) => {
  let index = codeIndexes.get(directory)
  if (!index) {
    index = readCatalogCodes(directory)
    codeIndexes.set(directory, index)
  }
  return index
}

export type CatalogEntry = {
  ean: string
  product: CatalogProduct
}

export const findCatalogProduct = async (
  code: string,
  directory = eanDirectory
): Promise<CatalogEntry | undefined> => {
  const named = await readCatalogProduct(code, directory)
  if (named) return { ean: code, product: named }

  const index = await getCodeIndex(directory)
  const ean = index.get(code)
  if (ean === undefined) return undefined
  const product = await readCatalogProduct(ean, directory)
  return product && { ean, product }
}
