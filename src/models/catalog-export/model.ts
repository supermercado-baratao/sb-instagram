import 'server-only'

import { createHash } from 'node:crypto'

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import {
  CATALOG_DATA_EXTENSION,
  CATALOG_IMAGE_EXTENSION
} from '@/constants/catalog'
import { eanDirectory, noEanDirectory } from '@/infra/catalog/directory'
import { listCatalogBaseNames, readCatalogFile } from '@/infra/catalog/files'
import { getPhotoVersion, readPhoto } from '@/infra/photo'
import { photosDirectory } from '@/infra/photos-directory'
import { catalogModel } from '@/models/catalog/model'
import { getCodeType, type Product } from '@/models/product/product'
import { catalogExportRepo } from '@/repositories/catalog-export-repo'
import { productRepo } from '@/repositories/product-repo'

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
} from './catalog-export'

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

const hash = (data: Buffer | string) =>
  createHash('sha256').update(data).digest('hex')

// A photo picked from catalog/no-ean is a byte-for-byte copy, so the hash spots it under any name
const hashNoEanImages = async (directory: string, names: string[]) => {
  const hashes = await Promise.all(
    names.map(async (name) =>
      hash(
        await readCatalogFile(directory, `${name}${CATALOG_IMAGE_EXTENSION}`)
      )
    )
  )
  return new Set(hashes)
}

const readCatalogIndex = async (
  ean: string,
  noEan: string
): Promise<CatalogIndex> => {
  const names = await listCatalogBaseNames(noEan, CATALOG_IMAGE_EXTENSION)
  const codes = await catalogModel.readCodes(ean)
  return {
    // File names and codes lists alike, since an EAN may be in only one catalog product
    eans: new Set([
      ...(await listCatalogBaseNames(ean, CATALOG_DATA_EXTENSION)),
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

// Every field the catalog files take, so editing any of them makes the product new to the catalog
const getFingerprint = (
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
    const { image, errors } = await catalogModel.prepareImage(original)
    return image && errors.length === 0
      ? { image }
      : { reason: errors.join('; ') }
  } catch {
    return { reason: 'O arquivo da foto não é uma imagem válida' }
  }
}

const listProductsInExportOrder = (database: Database) =>
  // A single product takes its EAN before the groups that also have it
  productRepo
    .listAll(database)
    .toSorted((a, b) => a.codes.length - b.codes.length)

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
    catalogExportRepo.listAll(database).map((row) => [row.productId, row])
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

    const fingerprint = getFingerprint(product, photo.hash)
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

const getCachedPhoto = async (photos: string, photo: string) => {
  const key = `${photos}\0${photo}`
  const version = await getPhotoVersion(photo, { photos })
  if (version === undefined) {
    photoCache.delete(key)
    return
  }
  const cached = photoCache.get(key)
  if (cached?.version === version) return cached

  const buffer = await readPhoto(photo, { photos })
  if (!buffer) return
  const entry: CachedPhoto = { version, hash: hash(buffer) }
  photoCache.set(key, entry)
  return entry
}

// Statuses without checking the images, which listing every store product can't afford
const listStatuses = async (
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
    readPhotoHash: (photo) => getCachedPhoto(photos, photo)
  })
  return new Map(evaluations.map(({ product, status }) => [product.id, status]))
}

const checkPhotoFile = async (
  photos: string,
  photo: string
): Promise<PhotoOutcome> => {
  const buffer = await readPhoto(photo, { photos })
  if (!buffer) return { reason: PHOTO_NOT_FOUND }
  const outcome = await prepareImage(buffer)
  // Only the outcome is kept, never the image
  return 'reason' in outcome ? outcome : {}
}

// Checks the images of the products a page shows, which a ready status doesn't cover yet
const checkPhotos = async (
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

    const cached = await getCachedPhoto(photos, product.photo)
    if (!cached) {
      checked.set(product.id, { kind: 'pending', reason: PHOTO_NOT_FOUND })
      continue
    }
    cached.image ??= checkPhotoFile(photos, product.photo)
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

const build = async (
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
      const buffer = await readPhoto(photo, { photos })
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
      catalogExportRepo.upsert(transaction, {
        productId,
        fingerprint,
        exportedAt: now
      })
    }
  })

  return { files, exportedCount: exported.length }
}

export const catalogExportModel = {
  listStatuses,
  checkPhotos,
  build
}
