import { readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  CATALOG_DATA_EXTENSION,
  CATALOG_IMAGE_EXTENSION,
  type CatalogProduct,
  checkCatalogProduct
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
    return checkCatalogProduct(data).length === 0
      ? (data as CatalogProduct)
      : undefined
  } catch {
    return undefined
  }
}
