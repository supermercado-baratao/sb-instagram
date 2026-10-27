import {
  CATALOG_DATA_EXTENSION,
  CATALOG_IMAGE_EXTENSION,
  type CatalogProduct,
  isCatalogDescriptionName
} from '@/domain/catalog'
import {
  getCodeType,
  normalizeSearchText,
  type Product
} from '@/domain/product'

export type CatalogExportFolder = 'ean' | 'no-ean'

export type CatalogExportTarget = {
  folder: CatalogExportFolder
  base: string
}

export type CatalogExportCheck =
  | { status: 'ok'; target: CatalogExportTarget }
  | { status: 'skipped'; reason: string }

export type CatalogExportContext = {
  catalogEans: ReadonlySet<string>
  catalogNames: ReadonlySet<string>
  exportedNames: ReadonlySet<string>
}

export type SkippedProduct = Pick<Product, 'codes' | 'name'> & {
  reason: string
}

export const CATALOG_EXPORT_REPORT_FILE = 'relatorio.txt'

export const toCatalogDescriptionName = (name: string) =>
  normalizeSearchText(name)
    .replaceAll(/[^a-z\d]+/g, '-')
    .replaceAll(/^-|-$/g, '')

const isFilled = (value: string | null): value is string =>
  value !== null && value.trim() !== ''

const getMissingFieldsReason = ({ brand, unit }: Product) => {
  if (!isFilled(brand) && !isFilled(unit)) return 'Faltam a marca e a unidade'
  if (!isFilled(brand)) return 'Falta a marca'
  if (!isFilled(unit)) return 'Falta a unidade'
}

export const checkCatalogExport = (
  product: Product,
  { catalogEans, catalogNames, exportedNames }: CatalogExportContext
): CatalogExportCheck => {
  if (product.photo === null) return { status: 'skipped', reason: 'Sem foto' }

  // The catalog format keeps one code per product until it takes groups (#51)
  if (product.codes.length !== 1) {
    return {
      status: 'skipped',
      reason:
        'O produto tem mais de um código, e o catálogo ainda não aceita grupos'
    }
  }
  const [code] = product.codes

  if (getCodeType(code) === 'ean') {
    const missingFields = getMissingFieldsReason(product)
    if (missingFields) return { status: 'skipped', reason: missingFields }

    if (catalogEans.has(code)) {
      return { status: 'skipped', reason: 'O EAN já está no catálogo' }
    }

    return { status: 'ok', target: { folder: 'ean', base: code } }
  }

  const base = toCatalogDescriptionName(product.name)
  const fileName = `${base}${CATALOG_IMAGE_EXTENSION}`

  if (!isCatalogDescriptionName(base)) {
    return {
      status: 'skipped',
      reason: 'O nome do produto não tem letras para formar o nome do arquivo'
    }
  }

  if (catalogNames.has(base)) {
    return {
      status: 'skipped',
      reason: `O catálogo já tem a imagem ${fileName}`
    }
  }

  if (exportedNames.has(base)) {
    return {
      status: 'skipped',
      reason: `Outro produto já foi exportado como ${fileName}`
    }
  }

  return { status: 'ok', target: { folder: 'no-ean', base } }
}

export const getCatalogExportImagePath = ({
  folder,
  base
}: CatalogExportTarget) => `${folder}/${base}${CATALOG_IMAGE_EXTENSION}`

export const getCatalogExportDataPath = ({
  folder,
  base
}: CatalogExportTarget) => `${folder}/${base}${CATALOG_DATA_EXTENSION}`

// Matches Prettier's JSON output, so the files pass `pnpm prettier:check` once in the repository
export const formatCatalogProduct = (product: Product) => {
  const data: CatalogProduct = {
    name: product.name.trim(),
    brand: product.brand?.trim() ?? '',
    unit: product.unit?.trim() ?? ''
  }
  return `${JSON.stringify(data, null, 2)}\n`
}

export const formatCatalogExportReport = (skipped: SkippedProduct[]) => {
  if (skipped.length === 0) {
    return 'Todos os produtos entraram na exportação para o catálogo.\n'
  }

  const lines = skipped.map(
    ({ codes, name, reason }) => `${codes.join(', ')} · ${name}: ${reason}`
  )
  return [
    'Produtos que ficaram fora da exportação para o catálogo:',
    '',
    ...lines,
    ''
  ].join('\n')
}
