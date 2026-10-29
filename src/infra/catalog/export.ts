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
  type SkipKind,
  type SkippedProduct
} from '@/domain/catalog-export'
import { getCodeType, type Product } from '@/domain/product'
import { eanDirectory, noEanDirectory } from '@/infra/catalog/directory'
import { prepareCatalogImage } from '@/infra/catalog/optimize'
import { readCatalogCodes } from '@/infra/catalog/product'
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
): Promise<{ image: Buffer } | { kind: SkipKind; reason: string }> => {
  const original = product.photo && (await readPhoto(photos, product.photo))
  if (!original) return { kind: 'pending', reason: 'A foto não foi encontrada' }

  const isInternal = product.codes.every(
    (code) => getCodeType(code) === 'internal'
  )
  if (isInternal && noEanHashes.has(hash(original))) {
    return { kind: 'in-catalog', reason: 'A foto é uma imagem do catálogo' }
  }

  try {
    const { image, errors } = await prepareCatalogImage(original)
    return image && errors.length === 0
      ? { image }
      : { kind: 'pending', reason: errors.join('; ') }
  } catch {
    return {
      kind: 'pending',
      reason: 'O arquivo da foto não é uma imagem válida'
    }
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
  const catalogCodes = await readCatalogCodes(ean)
  const context = {
    catalogEans: new Set([
      ...(await listBaseNames(ean, CATALOG_DATA_EXTENSION)),
      ...catalogCodes.keys()
    ]),
    exportedEans: new Set<string>(),
    catalogNames: new Set(catalogNames),
    exportedNames: new Set<string>()
  }
  const noEanHashes = await hashNoEanImages(noEan, catalogNames)

  // A single product takes its EAN before the groups that also have it
  const rows = attachCodes(
    database,
    database
      .select()
      .from(products)
      .orderBy(searchText(products.name), firstProductCode)
      .all()
  ).toSorted((a, b) => a.codes.length - b.codes.length)

  const files: Record<string, Uint8Array> = {}
  const skipped: SkippedProduct[] = []
  const skip = ({ codes, name }: Product, kind: SkipKind, reason: string) => {
    skipped.push({ codes, name, kind, reason })
  }

  // One photo at a time, so a large instance doesn't hold every decoded image in memory at once
  for (const product of rows) {
    const check = checkCatalogExport(product, context)
    if (check.status === 'skipped') {
      skip(product, check.kind, check.reason)
      continue
    }

    const photo = await preparePhoto(product, photos, noEanHashes)
    if ('reason' in photo) {
      skip(product, photo.kind, photo.reason)
      continue
    }

    const { target } = check
    files[getCatalogExportImagePath(target)] = photo.image
    if (target.folder === 'ean') {
      files[getCatalogExportDataPath(target)] = new TextEncoder().encode(
        formatCatalogProduct(product, target.codes)
      )
      for (const code of [target.base, ...target.codes]) {
        context.exportedEans.add(code)
      }
    } else {
      context.exportedNames.add(target.base)
    }
  }

  files[CATALOG_EXPORT_REPORT_FILE] = new TextEncoder().encode(
    formatCatalogExportReport(skipped)
  )
  return files
}
