import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

import { eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import { CATALOG_IMAGE_EXTENSION } from '@/domain/catalog'
import {
  type FoundProduct,
  getCodeType,
  normalizeCode,
  type Product
} from '@/domain/product'
import { eanDirectory } from '@/infra/catalog/directory'
import {
  getCatalogImageFile,
  readCatalogProduct
} from '@/infra/catalog/product'
import { products } from '@/infra/database/schema'
import { photosDirectory } from '@/infra/photos-directory'

type Database = BetterSQLite3Database

type ProductDirectories = {
  catalog?: string
  photos?: string
}

export const findProductByCode = async (
  database: Database,
  rawCode: string,
  { catalog = eanDirectory }: ProductDirectories = {}
): Promise<FoundProduct | undefined> => {
  const code = normalizeCode(rawCode)
  if (code === '') return undefined

  const saved = database
    .select()
    .from(products)
    .where(eq(products.code, code))
    .get()
  if (saved) return { product: saved, source: 'instance' }

  // Internal codes differ from store to store, so the catalog only knows products by EAN
  if (getCodeType(code) !== 'ean') return undefined

  const catalogProduct = await readCatalogProduct(code, catalog)
  if (!catalogProduct) return undefined

  return {
    product: { code, codeType: 'ean', ...catalogProduct, photo: null },
    source: 'catalog'
  }
}

// The photo is copied rather than referenced, so a later catalog update never changes a product
// the store already uses
const copyCatalogPhoto = async (
  code: string,
  catalog: string,
  photos: string
) => {
  const photo = `${code}${CATALOG_IMAGE_EXTENSION}`
  await mkdir(photos, { recursive: true })
  try {
    await copyFile(getCatalogImageFile(code, catalog), path.join(photos, photo))
    return photo
  } catch {
    return null
  }
}

export const saveProduct = async (
  database: Database,
  { product, source }: FoundProduct,
  { catalog = eanDirectory, photos = photosDirectory }: ProductDirectories = {}
): Promise<Product> => {
  const code = normalizeCode(product.code)
  const saved: Product = {
    ...product,
    code,
    codeType: getCodeType(code),
    photo:
      source === 'catalog'
        ? await copyCatalogPhoto(code, catalog, photos)
        : product.photo
  }

  database
    .insert(products)
    .values(saved)
    .onConflictDoUpdate({ target: products.code, set: saved })
    .run()

  return saved
}
