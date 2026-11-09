import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import {
  CATALOG_DATA_EXTENSION,
  CATALOG_IMAGE_EXTENSION
} from '@/domain/catalog'
import {
  CATALOG_EXPORT_REPORT_FILE,
  type CatalogExportContext,
  type CatalogExportTarget,
  type CatalogStatus,
  checkCatalogExport,
  EXPORTED_UNCHANGED_REASON,
  formatCatalogExportReport,
  formatCatalogProduct,
  getCatalogExportDataPath,
  getCatalogExportImagePath,
  type SkippedProduct
} from '@/domain/catalog-export'
import { getCodeType, type Product } from '@/domain/product'
import { eanDirectory, noEanDirectory } from '@/infra/catalog/directory'
import { prepareCatalogImage } from '@/infra/catalog/optimize'
import { readCatalogCodes } from '@/infra/catalog/product'
import { catalogExports, products } from '@/infra/database/schema'
import { searchText } from '@/infra/database/search-text'
import { photosDirectory } from '@/infra/photos-directory'
import { attachCodes, firstProductCode } from '@/infra/product'

type Database = BetterSQLite3Database

export type CatalogExportDirectories = {
  photos?: string
  ean?: string
  noEan?: string
}

type CatalogIndex = {
  eans: ReadonlySet<string>
  names: ReadonlySet<string>
  noEanHashes: ReadonlySet<string>
}

type ProductEvaluation = {
  product: Product
  status: CatalogStatus
  target?: CatalogExportTarget
  fingerprint?: string
  image?: Buffer
}

type PhotoOutcome = { image?: Buffer } | { reason: string }

const PHOTO_NOT_FOUND = 'A foto não foi encontrada'

const listBaseNames = async (directory: string, extension: string) => {
  const fileNames = await readdir(directory)
  return fileNames
    .filter((fileName) => fileName.endsWith(extension))
    .map((fileName) => fileName.slice(0, -extension.length))
}

const hash = (data: Buffer | string) =>
  createHash('sha256').update(data).digest('hex')

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

const readCatalogIndex = async (
  ean: string,
  noEan: string
): Promise<CatalogIndex> => {
  const names = await listBaseNames(noEan, CATALOG_IMAGE_EXTENSION)
  const codes = await readCatalogCodes(ean)
  return {
    // File names and codes lists alike, since an EAN may be in only one catalog product
    eans: new Set([
      ...(await listBaseNames(ean, CATALOG_DATA_EXTENSION)),
      ...codes.keys()
    ]),
    names: new Set(names),
    noEanHashes: await hashNoEanImages(noEan, names)
  }
}

// The catalog only changes with a new image, so it is read once per process, like the lookups
const catalogIndexes = new Map<string, Promise<CatalogIndex>>()

const getCatalogIndex = (ean: string, noEan: string) => {
  const key = `${ean}\0${noEan}`
  let index = catalogIndexes.get(key)
  if (!index) {
    index = readCatalogIndex(ean, noEan)
    catalogIndexes.set(key, index)
  }
  return index
}

const readPhoto = async (photos: string, photo: string) => {
  try {
    return await readFile(path.join(photos, photo))
  } catch {
    return
  }
}

// Every field the catalog files take, so editing any of them makes the product new to the catalog
export const getCatalogFingerprint = (
  { description, unit, codes }: Pick<Product, 'description' | 'unit' | 'codes'>,
  photoHash: string
) =>
  hash(
    JSON.stringify([description.trim(), unit?.trim() ?? '', codes, photoHash])
  )

const isInternalOnly = (product: Product) =>
  product.codes.every((code) => getCodeType(code) === 'internal')

const prepareImage = async (original: Buffer): Promise<PhotoOutcome> => {
  try {
    const { image, errors } = await prepareCatalogImage(original)
    return image && errors.length === 0
      ? { image }
      : { reason: errors.join('; ') }
  } catch {
    return { reason: 'O arquivo da foto não é uma imagem válida' }
  }
}

const listProductsInExportOrder = (database: Database) =>
  // A single product takes its EAN before the groups that also have it
  attachCodes(
    database,
    database
      .select()
      .from(products)
      .orderBy(searchText(products.description), firstProductCode)
      .all()
  ).toSorted((a, b) => a.codes.length - b.codes.length)

type EvaluateOptions = {
  ean: string
  noEan: string
  readPhotoHash: (
    photo: string
  ) => Promise<{ hash: string; buffer?: Buffer } | undefined>
  // Only the export prepares the images, since the list checks them a page at a time
  checkImage?: (
    product: Product,
    photo: { hash: string; buffer?: Buffer },
    exported: boolean
  ) => Promise<PhotoOutcome>
}

// Products are taken in the export order, so an EAN or name goes to the first product that can
// take it, like in the ZIP
const evaluateProducts = async (
  database: Database,
  { ean, noEan, readPhotoHash, checkImage }: EvaluateOptions
) => {
  const index = await getCatalogIndex(ean, noEan)
  const exports = new Map(
    database
      .select()
      .from(catalogExports)
      .all()
      .map((row) => [row.productId, row])
  )
  const exportedEans = new Set<string>()
  const exportedNames = new Set<string>()
  const context: CatalogExportContext = {
    catalogEans: index.eans,
    exportedEans,
    catalogNames: index.names,
    exportedNames
  }
  const claim = ({ folder, base, codes }: CatalogExportTarget) => {
    if (folder === 'ean') {
      for (const code of [base, ...codes]) exportedEans.add(code)
    } else {
      exportedNames.add(base)
    }
  }

  const evaluations: ProductEvaluation[] = []
  // One photo at a time, so a large instance doesn't hold every decoded image in memory at once
  for (const product of listProductsInExportOrder(database)) {
    const check = checkCatalogExport(product, context)
    if (check.status === 'skipped') {
      evaluations.push({
        product,
        status: { kind: check.kind, reason: check.reason }
      })
      continue
    }

    const photo = product.photo ? await readPhotoHash(product.photo) : undefined
    if (!photo) {
      evaluations.push({
        product,
        status: { kind: 'pending', reason: PHOTO_NOT_FOUND }
      })
      continue
    }

    if (isInternalOnly(product) && index.noEanHashes.has(photo.hash)) {
      evaluations.push({
        product,
        status: {
          kind: 'in-catalog',
          reason: 'A foto é uma imagem do catálogo'
        }
      })
      continue
    }

    const fingerprint = getCatalogFingerprint(product, photo.hash)
    const exported = exports.get(product.id)
    const unchanged = exported?.fingerprint === fingerprint
    const outcome = checkImage
      ? await checkImage(product, photo, unchanged)
      : {}
    if ('reason' in outcome) {
      evaluations.push({
        product,
        status: { kind: 'pending', reason: outcome.reason }
      })
      continue
    }

    claim(check.target)
    evaluations.push({
      product,
      status:
        unchanged && exported
          ? { kind: 'exported', exportedAt: exported.exportedAt }
          : { kind: 'ready' },
      target: check.target,
      fingerprint,
      image: outcome.image
    })
  }
  return evaluations
}

type CachedPhoto = {
  version: string
  hash: string
  image?: Promise<PhotoOutcome>
}

// Keyed by the file's size and change time, so a new upload under the same name is read again
const photoCache = new Map<string, CachedPhoto>()

const getCachedPhoto = async (file: string) => {
  let version: string
  try {
    const { size, mtimeMs } = await stat(file)
    version = `${size}:${mtimeMs}`
  } catch {
    photoCache.delete(file)
    return
  }
  const cached = photoCache.get(file)
  if (cached?.version === version) return cached

  let buffer: Buffer
  try {
    buffer = await readFile(file)
  } catch {
    return
  }
  const entry: CachedPhoto = { version, hash: hash(buffer) }
  photoCache.set(file, entry)
  return entry
}

// Statuses without checking the images, which listing every store product can't afford
export const listCatalogStatuses = async (
  database: Database,
  {
    photos = photosDirectory,
    ean = eanDirectory,
    noEan = noEanDirectory
  }: CatalogExportDirectories = {}
) => {
  const evaluations = await evaluateProducts(database, {
    ean,
    noEan,
    readPhotoHash: (photo) => getCachedPhoto(path.join(photos, photo))
  })
  return new Map(evaluations.map(({ product, status }) => [product.id, status]))
}

const checkPhotoFile = async (file: string): Promise<PhotoOutcome> => {
  let buffer: Buffer
  try {
    buffer = await readFile(file)
  } catch {
    return { reason: PHOTO_NOT_FOUND }
  }
  const outcome = await prepareImage(buffer)
  // Only the outcome is kept, never the image
  return 'reason' in outcome ? outcome : {}
}

// Checks the images of the products a page shows, which a ready status doesn't cover yet
export const checkCatalogPhotos = async (
  items: Product[],
  statuses: ReadonlyMap<string, CatalogStatus>,
  { photos = photosDirectory }: Pick<CatalogExportDirectories, 'photos'> = {}
) => {
  const checked = new Map<string, CatalogStatus>()
  for (const product of items) {
    const status = statuses.get(product.id)
    if (!status) continue
    checked.set(product.id, status)
    if (status.kind !== 'ready' || !product.photo) continue

    const file = path.join(photos, product.photo)
    const cached = await getCachedPhoto(file)
    if (!cached) {
      checked.set(product.id, { kind: 'pending', reason: PHOTO_NOT_FOUND })
      continue
    }
    cached.image ??= checkPhotoFile(file)
    const outcome = await cached.image
    if ('reason' in outcome) {
      checked.set(product.id, { kind: 'pending', reason: outcome.reason })
    }
  }
  return checked
}

export type CatalogExport = {
  files: Record<string, Uint8Array>
  exportedCount: number
}

export const buildCatalogExport = async (
  database: Database,
  {
    all = false,
    now = new Date(),
    photos = photosDirectory,
    ean = eanDirectory,
    noEan = noEanDirectory
  }: CatalogExportDirectories & { all?: boolean; now?: Date } = {}
): Promise<CatalogExport> => {
  const evaluations = await evaluateProducts(database, {
    ean,
    noEan,
    readPhotoHash: async (photo) => {
      const buffer = await readPhoto(photos, photo)
      return buffer && { hash: hash(buffer), buffer }
    },
    checkImage: async (_product, { buffer }, unchanged) => {
      // An unchanged product keeps its EANs, but its image was already sent
      if (unchanged && !all) return {}
      return buffer ? prepareImage(buffer) : { reason: PHOTO_NOT_FOUND }
    }
  })

  const files: Record<string, Uint8Array> = {}
  const skipped: SkippedProduct[] = []
  const exported: { productId: string; fingerprint: string }[] = []

  for (const { product, status, target, fingerprint, image } of evaluations) {
    const { codes, description } = product
    if (status.kind === 'pending' || status.kind === 'in-catalog') {
      skipped.push({ codes, description, ...status })
      continue
    }
    if (!target || !fingerprint || !image) {
      skipped.push({
        codes,
        description,
        kind: 'exported',
        reason: EXPORTED_UNCHANGED_REASON
      })
      continue
    }

    files[getCatalogExportImagePath(target)] = image
    if (target.folder === 'ean') {
      files[getCatalogExportDataPath(target)] = new TextEncoder().encode(
        formatCatalogProduct(product, target.codes)
      )
    }
    exported.push({ productId: product.id, fingerprint })
  }

  files[CATALOG_EXPORT_REPORT_FILE] = new TextEncoder().encode(
    formatCatalogExportReport(skipped)
  )

  database.transaction((transaction) => {
    for (const { productId, fingerprint } of exported) {
      transaction
        .insert(catalogExports)
        .values({ productId, fingerprint, exportedAt: now })
        .onConflictDoUpdate({
          target: catalogExports.productId,
          set: { fingerprint, exportedAt: now }
        })
        .run()
    }
  })

  return { files, exportedCount: exported.length }
}
