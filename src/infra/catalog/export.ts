import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import {
  CATALOG_DATA_EXTENSION,
  CATALOG_IMAGE_EXTENSION
} from '@/domain/catalog'
import {
  CATALOG_EXPORT_REPORT_FILE,
  checkCatalogExport,
  formatCatalogExportReport,
  formatCatalogProduct,
  getCatalogExportDataPath,
  getCatalogExportImagePath,
  type SkippedProduct
} from '@/domain/catalog-export'
import { getCodeType, type Product } from '@/domain/product'
import { eanDirectory, noEanDirectory } from '@/infra/catalog/directory'
import { prepareCatalogImage } from '@/infra/catalog/optimize'
import { products } from '@/infra/database/schema'
import { searchText } from '@/infra/database/search-text'
import { photosDirectory } from '@/infra/photos-directory'
import { attachCodes, firstProductCode } from '@/infra/product'

type Database = BetterSQLite3Database

type CatalogExportDirectories = {
  photos?: string
  ean?: string
  noEan?: string
}

const listBaseNames = async (directory: string, extension: string) => {
  const fileNames = await readdir(directory)
  return fileNames
    .filter((fileName) => fileName.endsWith(extension))
    .map((fileName) => fileName.slice(0, -extension.length))
}

const hash = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')

// A photo picked from catalog/no-ean is a byte-for-byte copy, so the hash spots it under any name
const hashNoEanImages = async (directory: string, names: string[]) => {
  const hashes = await Promise.all(
    names.map(async (name) =>
      hash(
        await readFile(
          path.join(directory, `${name}${CATALOG_IMAGE_EXTENSION}`)
        )
      )
    )
  )
  return new Set(hashes)
}

const readPhoto = async (photos: string, photo: string) => {
  try {
    return await readFile(path.join(photos, photo))
  } catch {
    return
  }
}

const preparePhoto = async (
  product: Product,
  photos: string,
  noEanHashes: ReadonlySet<string>
): Promise<{ image: Buffer } | { reason: string }> => {
  const original = product.photo && (await readPhoto(photos, product.photo))
  if (!original) return { reason: 'A foto não foi encontrada' }

  const isInternal = product.codes.every(
    (code) => getCodeType(code) === 'internal'
  )
  if (isInternal && noEanHashes.has(hash(original))) {
    return { reason: 'A foto é uma imagem do catálogo' }
  }

  try {
    const { image, errors } = await prepareCatalogImage(original)
    return image && errors.length === 0
      ? { image }
      : { reason: errors.join('; ') }
  } catch {
    return { reason: 'O arquivo da foto não é uma imagem válida' }
  }
}

export const buildCatalogExport = async (
  database: Database,
  {
    photos = photosDirectory,
    ean = eanDirectory,
    noEan = noEanDirectory
  }: CatalogExportDirectories = {}
): Promise<Record<string, Uint8Array>> => {
  const catalogNames = await listBaseNames(noEan, CATALOG_IMAGE_EXTENSION)
  const context = {
    catalogEans: new Set(await listBaseNames(ean, CATALOG_DATA_EXTENSION)),
    catalogNames: new Set(catalogNames),
    exportedNames: new Set<string>()
  }
  const noEanHashes = await hashNoEanImages(noEan, catalogNames)

  const rows = attachCodes(
    database,
    database
      .select()
      .from(products)
      .orderBy(searchText(products.name), firstProductCode)
      .all()
  )

  const files: Record<string, Uint8Array> = {}
  const skipped: SkippedProduct[] = []
  const skip = ({ codes, name }: Product, reason: string) => {
    skipped.push({ codes, name, reason })
  }

  // One photo at a time, so a large instance doesn't hold every decoded image in memory at once
  for (const product of rows) {
    const check = checkCatalogExport(product, context)
    if (check.status === 'skipped') {
      skip(product, check.reason)
      continue
    }

    const photo = await preparePhoto(product, photos, noEanHashes)
    if ('reason' in photo) {
      skip(product, photo.reason)
      continue
    }

    const { target } = check
    files[getCatalogExportImagePath(target)] = photo.image
    if (target.folder === 'ean') {
      files[getCatalogExportDataPath(target)] = new TextEncoder().encode(
        formatCatalogProduct(product)
      )
    } else {
      context.exportedNames.add(target.base)
    }
  }

  files[CATALOG_EXPORT_REPORT_FILE] = new TextEncoder().encode(
    formatCatalogExportReport(skipped)
  )
  return files
}
