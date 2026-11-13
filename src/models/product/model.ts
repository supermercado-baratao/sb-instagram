import 'server-only'

import { randomUUID } from 'node:crypto'

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import { eanDirectory, noEanDirectory } from '@/infra/catalog/directory'
import { AppError } from '@/infra/errors'
import {
  copyIntoPhotos,
  readPhoto as readPhotoFile,
  removePhoto,
  renamePhoto,
  savePhoto
} from '@/infra/photo'
import { photosDirectory } from '@/infra/photos-directory'
import { getCatalogProductCodes } from '@/models/catalog/catalog'
import { type CatalogEntry, catalogModel } from '@/models/catalog/model'
import { productRepo } from '@/repositories/product-repo'

import { isValidEan } from './ean'
import {
  compareProductListItems,
  getProductPage,
  getSearchWords,
  matchesProductQuery
} from './list'
import {
  type CatalogMatch,
  type CodeType,
  getCodeType,
  getPhotoFileName,
  getProductChanges,
  isSameCodeSet,
  isValidCode,
  normalizeCode,
  normalizeCodes,
  type Product,
  PRODUCT_SUGGESTION_LIMIT,
  type ProductChange,
  type ProductDetails,
  type ProductListFilter,
  type ProductListItem,
  type ProductPage
} from './product'
import {
  addCodeSchema,
  codeSchema,
  isProductId,
  type MergeInput,
  mergeSchema,
  MISSING_PRODUCT_MESSAGE,
  type ProductFormInput,
  productFormSchema,
  productIdSchema,
  voiceTextSchema
} from './schema'

type Database = BetterSQLite3Database

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

type ProductDirectories = {
  catalog?: string
  photos?: string
  noEan?: string
}

const getDuplicateMessage = ({ description }: Product) =>
  `Já existe um produto com estes mesmos códigos: ${description}.`

const findById = (
  database: Database | Transaction,
  id: string
): Product | undefined =>
  isProductId(id) ? productRepo.findById(database, id) : undefined

const readPhoto = async (
  database: Database,
  id: string,
  { photos = photosDirectory }: ProductDirectories = {}
) => {
  const photo = findById(database, id)?.photo
  return photo ? readPhotoFile(photo, { photos }) : undefined
}

// A single product comes before the groups that also have its code, smaller groups first
const listInstanceProducts = (database: Database | Transaction, code: string) =>
  productRepo
    .listByCode(database, code)
    .toSorted((a, b) => a.codes.length - b.codes.length)

const findWithCodes = (database: Database | Transaction, codes: string[]) => {
  const [first] = normalizeCodes(codes)
  if (first === undefined) return
  return listInstanceProducts(database, first).find((product) =>
    isSameCodeSet(product.codes, codes)
  )
}

const toCatalogMatch = ({ ean, product }: CatalogEntry): CatalogMatch => ({
  ean,
  codes: getCatalogProductCodes(ean, product),
  description: product.description,
  unit: product.unit
})

export type CodeLookup =
  | { source: 'instance'; products: Product[] }
  | { source: 'catalog'; product: CatalogMatch }

const findByCode = async (
  database: Database,
  rawCode: string,
  { catalog = eanDirectory }: ProductDirectories = {}
): Promise<CodeLookup | undefined> => {
  const code = normalizeCode(rawCode)
  if (code === '') return undefined

  const saved = listInstanceProducts(database, code)
  if (saved.length > 0) return { source: 'instance', products: saved }

  // Internal codes differ from store to store, so the catalog only knows products by EAN
  if (getCodeType(code) !== 'ean') return undefined

  const found = await catalogModel.findProduct(code, catalog)
  if (!found) return undefined

  return { source: 'catalog', product: toCatalogMatch(found) }
}

export type LookupResult =
  // Every product of the instance with the code, a single product before the groups
  | { status: 'found'; code: string; products: Product[] }
  | { status: 'catalog'; code: string; product: CatalogMatch }
  | { status: 'new'; code: string; codeType: CodeType }

const lookup = async (
  database: Database,
  rawCode: string,
  directories: ProductDirectories = {}
): Promise<LookupResult> => {
  const code = codeSchema.parse(rawCode)
  const found = await findByCode(database, code, directories)
  if (!found) return { status: 'new', code, codeType: getCodeType(code) }
  return found.source === 'instance'
    ? { status: 'found', code, products: found.products }
    : { status: 'catalog', code, product: found.product }
}

export type PhotoSource =
  | { kind: 'upload'; image: Buffer }
  | { kind: 'no-ean'; name: string }
  | { kind: 'ean'; ean: string }

export type ProductInput = ProductDetails & {
  // Left out for a new product
  id?: string
  codes: string[]
  // Left out, the current text stays
  voiceText?: string | null
  // Left out, the current photo stays, renamed if the codes change its file name
  photo?: PhotoSource
}

const PHOTO_ERROR_MESSAGES: Record<PhotoSource['kind'], string> = {
  upload: 'Não foi possível ler a foto. Envie uma imagem JPG, PNG ou WebP.',
  'no-ean': 'A imagem escolhida não está mais no catálogo.',
  ean: 'Não foi possível copiar a imagem do catálogo.'
}

const writePhotoSource = async (
  source: PhotoSource,
  fileName: string,
  {
    catalog = eanDirectory,
    photos = photosDirectory,
    noEan = noEanDirectory
  }: ProductDirectories
) => {
  try {
    switch (source.kind) {
      case 'upload': {
        await savePhoto(fileName, source.image, { photos })
        return fileName
      }
      case 'no-ean': {
        const file = catalogModel.getNoEanImage(source.name, noEan)
        if (!file) throw new Error(`Invalid catalog image name: ${source.name}`)
        await copyIntoPhotos(file, fileName, { photos })
        return fileName
      }
      case 'ean': {
        const file = await catalogModel.findEanImage(source.ean, catalog)
        if (!file) return null
        await copyIntoPhotos(file, fileName, { photos })
        return fileName
      }
    }
  } catch (error) {
    throw new AppError(PHOTO_ERROR_MESSAGES[source.kind], { cause: error })
  }
}

const checkDuplicateCodes = (
  database: Database | Transaction,
  id: string,
  codes: string[]
) => {
  const duplicate = findWithCodes(database, codes)
  if (duplicate && duplicate.id !== id) {
    throw new AppError(getDuplicateMessage(duplicate))
  }
}

const save = async (
  database: Database,
  input: ProductInput,
  directories: ProductDirectories = {}
): Promise<Product> => {
  const codes = normalizeCodes(input.codes)
  if (codes.length === 0) throw new Error('A product needs at least one code')
  const invalid = codes.find((code) => !isValidCode(code))
  if (invalid !== undefined) throw new Error(`Invalid product code: ${invalid}`)

  const current =
    input.id === undefined ? undefined : findById(database, input.id)
  if (!current && input.id !== undefined) {
    throw new AppError(MISSING_PRODUCT_MESSAGE)
  }

  const id = current?.id ?? randomUUID()
  // Checked before any photo is written, so a refused save leaves nothing behind
  checkDuplicateCodes(database, id, codes)

  const { photos = photosDirectory } = directories
  const fileName = getPhotoFileName({ id, codes })
  let photo = current?.photo ?? null
  if (input.photo) {
    photo = await writePhotoSource(input.photo, fileName, directories)
  } else if (photo !== null && photo !== fileName) {
    try {
      await renamePhoto(photo, fileName, { photos })
      photo = fileName
    } catch {
      // The file is already gone, so the product is left without a photo instead of a broken one
      photo = null
    }
  }

  const saved: Product = {
    id,
    codes,
    description: input.description,
    unit: input.unit,
    voiceText:
      input.voiceText === undefined
        ? (current?.voiceText ?? null)
        : input.voiceText,
    photo
  }

  database.transaction((transaction) => {
    // Another save may have taken these codes since the check above
    checkDuplicateCodes(transaction, id, codes)
    productRepo.upsert(transaction, saved)
  })

  // A new photo under a new file name leaves the old file behind
  if (current?.photo && input.photo && current.photo !== fileName) {
    await removePhoto(current.photo, { photos })
  }

  return saved
}

export type PhotoChange = 'added' | 'replaced' | null

export type SaveFormResult =
  | { status: 'saved'; product: Product }
  | { status: 'unchanged'; product: Product }
  | {
      status: 'confirm'
      current: Product
      changes: ProductChange[]
      photoChange: PhotoChange
    }

const saveForm = async (
  database: Database,
  input: ProductFormInput,
  directories: ProductDirectories = {}
): Promise<SaveFormResult> => {
  const form = productFormSchema.parse(input)
  const { codes, photo: upload } = form
  // The community's no-EAN images are for products the catalog can't know by code
  const catalogImage = codes.some((code) => getCodeType(code) === 'ean')
    ? ''
    : form.catalogImage
  const details = {
    description: form.description,
    unit: form.unit,
    voiceText: form.voiceText
  }

  // The current product and photo come from the server, never from the form
  let current = form.id === '' ? undefined : findById(database, form.id)
  if (!current && form.id !== '') throw new AppError(MISSING_PRODUCT_MESSAGE)

  const duplicate = findWithCodes(database, codes)
  if (duplicate && current && duplicate.id !== current.id) {
    throw new AppError(getDuplicateMessage(duplicate))
  }
  if (duplicate && !current) {
    if (form.replace === undefined) {
      throw new AppError(getDuplicateMessage(duplicate))
    }

    // Registering the codes of a product the store already has must not overwrite it unnoticed
    if (form.replace === 'ask') {
      const changes = getProductChanges(duplicate, details)
      const hasNewPhoto = upload !== undefined || catalogImage !== ''
      if (!hasNewPhoto && changes.length === 0) {
        return { status: 'unchanged', product: duplicate }
      }
      const photoChange = duplicate.photo ? 'replaced' : 'added'
      return {
        status: 'confirm',
        current: duplicate,
        changes,
        photoChange: hasNewPhoto ? photoChange : null
      }
    }
    current = duplicate
  }

  let photo: PhotoSource | undefined
  if (upload) {
    photo = { kind: 'upload', image: Buffer.from(await upload.arrayBuffer()) }
  } else if (catalogImage !== '') {
    photo = { kind: 'no-ean', name: catalogImage }
  } else if (!current && isValidEan(form.catalogEan)) {
    // A new product found in the community catalog starts with the image the form showed
    photo = { kind: 'ean', ean: form.catalogEan }
  }

  const product = await save(
    database,
    { id: current?.id, codes, ...details, photo },
    directories
  )
  return { status: 'saved', product }
}

const addCode = async (
  database: Database,
  input: { id: unknown; code: unknown },
  directories: ProductDirectories = {}
): Promise<Product> => {
  const { id, code } = addCodeSchema.parse(input)
  const current = findById(database, id)
  if (!current) throw new AppError(MISSING_PRODUCT_MESSAGE)

  return save(
    database,
    {
      id: current.id,
      codes: [...current.codes, code],
      description: current.description,
      unit: current.unit
    },
    directories
  )
}

export type SlotLookupResult =
  | { status: 'found'; product: Product }
  // The code is in a single product and in groups that also have it (#55)
  | { status: 'choose'; code: string; products: Product[] }
  | { status: 'missing'; code: string }

const lookupForSlot = async (
  database: Database,
  rawCode: string,
  directories: ProductDirectories = {}
): Promise<SlotLookupResult> => {
  const code = codeSchema.parse(rawCode)
  const found = await findByCode(database, code, directories)
  if (!found) return { status: 'missing', code }

  if (found.source === 'instance') {
    return found.products.length === 1
      ? { status: 'found', product: found.products[0] }
      : { status: 'choose', code, products: found.products }
  }

  // An offer item points to a row of products, so a catalog product joins the store's products
  const { ean, ...details } = found.product
  const product = await save(
    database,
    { ...details, photo: { kind: 'ean', ean } },
    directories
  )
  return { status: 'found', product }
}

// Only the voice text, so the Comercial tab never rewrites the codes or the photo (#111). A blank
// text goes back to the suggestion
const saveVoiceText = (
  database: Database,
  input: { id: unknown; voiceText: unknown }
): Product => {
  const { id, voiceText } = voiceTextSchema.parse(input)
  const product = productRepo.updateVoiceText(
    database,
    id,
    voiceText.trim() || null
  )
  if (!product) {
    throw new AppError(
      'Este produto foi excluído. Recarregue a página para ver a oferta atual.'
    )
  }
  return product
}

const listStoreItems = (database: Database, query: string) =>
  productRepo
    .listMatching(database, getSearchWords(query))
    .map((product) => ({ origin: 'store' as const, product }))

const listCatalogItems = async (
  database: Database,
  query: string,
  catalog: string
) => {
  const storeCodes = productRepo.listCodes(database)
  const entries = await catalogModel.listEntries(catalog)
  return entries
    .map((entry) => toCatalogMatch(entry))
    .filter(
      (product) =>
        product.codes.every((code) => !storeCodes.has(code)) &&
        matchesProductQuery(product, query)
    )
    .map((product): ProductListItem => ({ origin: 'catalog', product }))
}

const list = async (
  database: Database,
  {
    query = '',
    page = 1,
    filter = 'all',
    catalogExportIds = new Set()
  }: {
    query?: string
    page?: number
    filter?: ProductListFilter
    // Store products the store still has to send to the catalog, see listCatalogStatuses
    catalogExportIds?: ReadonlySet<string>
  } = {},
  { catalog = eanDirectory }: ProductDirectories = {}
): Promise<ProductPage> => {
  const storeItems = filter === 'catalog' ? [] : listStoreItems(database, query)
  const items = [
    ...(filter === 'outside-catalog'
      ? storeItems.filter(({ product }) => catalogExportIds.has(product.id))
      : storeItems),
    ...(filter === 'all' || filter === 'catalog'
      ? await listCatalogItems(database, query, catalog)
      : [])
  ]
  return getProductPage(items.toSorted(compareProductListItems), page)
}

// Only the instance: the catalog is looked up by code, through lookup
const search = (
  database: Database,
  query: string,
  { limit = PRODUCT_SUGGESTION_LIMIT }: { limit?: number } = {}
): Product[] => {
  const words = getSearchWords(query)
  return words.length === 0
    ? []
    : productRepo.searchMatching(database, words, limit)
}

export type DeleteProductResult = { status: 'deleted' } | { status: 'in-use' }

// The offer is left untouched: whoever deletes the product takes it out of the offer first (#28)
const remove = async (
  database: Database,
  rawId: unknown,
  { photos = photosDirectory }: ProductDirectories = {}
): Promise<DeleteProductResult> => {
  const id = productIdSchema.parse(rawId)
  if (productRepo.isInOffer(database, [id])) return { status: 'in-use' }

  const product = productRepo.findById(database, id)
  productRepo.deleteByIds(database, [id])
  if (product?.photo) await removePhoto(product.photo, { photos })
  return { status: 'deleted' }
}

export type MergePreview = {
  kept: Product
  merged: Product[]
  // Codes the kept product gains
  codes: string[]
  // Whether items of the offer move to the kept product
  changesOffer: boolean
}

const loadMerge = (database: Database | Transaction, input: MergeInput) => {
  const { keepId, mergedIds } = mergeSchema.parse(input)
  const ids = [keepId, ...mergedIds]
  const found = ids.map((id) => {
    const product = productRepo.findById(database, id)
    if (!product) {
      throw new AppError(
        'Um dos produtos selecionados não existe mais. Atualize a página e selecione de novo.'
      )
    }
    return product
  })
  const [kept, ...merged] = found as [Product, ...Product[]]
  const codes = normalizeCodes(found.flatMap((product) => product.codes))

  // The merged products are deleted, so only a product outside the merge can hold the same set
  const duplicate = findWithCodes(database, codes)
  if (duplicate && !ids.includes(duplicate.id)) {
    throw new AppError(
      `Os produtos juntos teriam os mesmos códigos de “${duplicate.description}”. Mescle-o junto ou escolha outros produtos.`
    )
  }

  return { kept, merged, mergedIds, codes }
}

const previewMerge = (database: Database, input: MergeInput): MergePreview => {
  const { kept, merged, mergedIds, codes } = loadMerge(database, input)
  return {
    kept,
    merged,
    codes: codes.filter((code) => !kept.codes.includes(code)),
    changesOffer: productRepo.isInOffer(database, mergedIds)
  }
}

// Joins products registered apart by mistake: the kept product takes every code and offer item,
// and the others are deleted with their photos (#50)
const merge = async (
  database: Database,
  input: MergeInput,
  { photos = photosDirectory }: ProductDirectories = {}
): Promise<Product> => {
  const { kept, merged, mergedIds, codes } = loadMerge(database, input)

  const fileName = getPhotoFileName({ id: kept.id, codes })
  let photo = kept.photo
  if (photo !== null && photo !== fileName) {
    try {
      await renamePhoto(photo, fileName, { photos })
      photo = fileName
    } catch {
      // The file is already gone, so the product is left without a photo instead of a broken one
      photo = null
    }
  }

  database.transaction((transaction) => {
    loadMerge(transaction, input)

    productRepo.updatePhoto(transaction, kept.id, photo)
    productRepo.addCodes(transaction, kept.id, codes)
    productRepo.moveOfferItems(transaction, mergedIds, kept.id)

    // A page that had two of the merged products would show the kept one twice
    const items = productRepo.listOfferItems(transaction, kept.id)
    const repeated = items.filter(
      (item, index) => index > 0 && items[index - 1]?.pageId === item.pageId
    )
    for (const item of repeated) productRepo.deleteOfferItem(transaction, item)

    productRepo.deleteByIds(transaction, mergedIds)
  })

  for (const product of merged) {
    if (product.photo) await removePhoto(product.photo, { photos })
  }

  return { ...kept, codes, photo }
}

// Products saved before #55 keep the photo under their old main code. A group must move to its id,
// or a product later saved with only that code would write over the group's photo
const renameOutdatedPhotos = async (
  database: Database,
  { photos = photosDirectory }: ProductDirectories = {}
) => {
  const outdated = productRepo
    .listWithPhoto(database)
    .flatMap(({ photo, ...product }) =>
      photo !== null && photo !== getPhotoFileName(product)
        ? [{ ...product, photo }]
        : []
    )

  // Groups move to their ids first, freeing the code names a single product may need
  const groupsFirst = outdated.toSorted(
    (a, b) => b.codes.length - a.codes.length
  )
  for (const product of groupsFirst) {
    const fileName = getPhotoFileName(product)
    try {
      await renamePhoto(product.photo, fileName, { photos })
    } catch {
      // A photo missing from the disk is served as no photo either way
      continue
    }
    productRepo.updatePhoto(database, product.id, fileName)
  }
}

export const productModel = {
  findById,
  readPhoto,
  findWithCodes,
  findByCode,
  lookup,
  lookupForSlot,
  save,
  saveForm,
  addCode,
  saveVoiceText,
  list,
  search,
  remove,
  previewMerge,
  merge,
  renameOutdatedPhotos
}
