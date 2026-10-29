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
  // The other EANs, written to the JSON of an ean/ product
  codes: string[]
}

export type SkipKind = 'pending' | 'in-catalog'

export type CatalogExportCheck =
  | { status: 'ok'; target: CatalogExportTarget }
  | { status: 'skipped'; kind: SkipKind; reason: string }

export type CatalogExportContext = {
  // File names and codes lists alike, since an EAN may be in only one catalog product
  catalogEans: ReadonlySet<string>
  exportedEans: ReadonlySet<string>
  catalogNames: ReadonlySet<string>
  exportedNames: ReadonlySet<string>
}

export type SkippedProduct = Pick<Product, 'codes' | 'name'> & {
  kind: SkipKind
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

const pending = (reason: string): CatalogExportCheck => ({
  status: 'skipped',
  kind: 'pending',
  reason
})

const inCatalog = (reason: string): CatalogExportCheck => ({
  status: 'skipped',
  kind: 'in-catalog',
  reason
})

// The catalog is checked first, so a product it already holds is never reported as pending
export const checkCatalogExport = (
  product: Product,
  {
    catalogEans,
    exportedEans,
    catalogNames,
    exportedNames
  }: CatalogExportContext
): CatalogExportCheck => {
  // Internal codes differ from store to store, so a group with an EAN takes only its EANs
  const eans = product.codes.filter((code) => getCodeType(code) === 'ean')
  if (eans.length > 0) {
    const catalogEan = eans.find((ean) => catalogEans.has(ean))
    if (catalogEan !== undefined) {
      return inCatalog(`O EAN ${catalogEan} já está no catálogo`)
    }

    if (product.photo === null) return pending('Sem foto')

    const missingFields = getMissingFieldsReason(product)
    if (missingFields) return pending(missingFields)

    const exported = eans.find((ean) => exportedEans.has(ean))
    if (exported !== undefined) {
      return pending(`O EAN ${exported} já foi exportado em outro produto`)
    }

    const [base, ...codes] = eans
    return { status: 'ok', target: { folder: 'ean', base, codes } }
  }

  const base = toCatalogDescriptionName(product.name)
  const fileName = `${base}${CATALOG_IMAGE_EXTENSION}`

  if (catalogNames.has(base)) {
    return inCatalog(`O catálogo já tem a imagem ${fileName}`)
  }

  if (product.photo === null) return pending('Sem foto')

  if (!isCatalogDescriptionName(base)) {
    return pending(
      'O nome do produto não tem letras para formar o nome do arquivo'
    )
  }

  if (exportedNames.has(base)) {
    return pending(`Outro produto já foi exportado como ${fileName}`)
  }

  return { status: 'ok', target: { folder: 'no-ean', base, codes: [] } }
}

export const getCatalogExportImagePath = ({
  folder,
  base
}: CatalogExportTarget) => `${folder}/${base}${CATALOG_IMAGE_EXTENSION}`

export const getCatalogExportDataPath = ({
  folder,
  base
}: CatalogExportTarget) => `${folder}/${base}${CATALOG_DATA_EXTENSION}`

const PRETTIER_PRINT_WIDTH = 80

// Prettier keeps an array on one line while it fits the print width
const formatCodesLine = (codes: string[]) => {
  const line = `  "codes": [${codes.map((code) => JSON.stringify(code)).join(', ')}]`
  return line.length <= PRETTIER_PRINT_WIDTH
    ? line
    : `  "codes": ${JSON.stringify(codes, null, 2).replaceAll('\n', '\n  ')}`
}

// Matches Prettier's JSON output, so the files pass `pnpm prettier:check` once in the repository
export const formatCatalogProduct = (product: Product, codes: string[]) => {
  const data: CatalogProduct = {
    name: product.name.trim(),
    brand: product.brand?.trim() ?? '',
    unit: product.unit?.trim() ?? ''
  }
  const json = JSON.stringify(data, null, 2)
  return codes.length === 0
    ? `${json}\n`
    : `${json.slice(0, -2)},\n${formatCodesLine(codes)}\n}\n`
}

const REPORT_SECTIONS: Record<SkipKind, string> = {
  pending: 'Produtos com pendências, que ficaram fora da exportação:',
  'in-catalog': 'Produtos que já estão no catálogo:'
}

export const formatCatalogExportReport = (skipped: SkippedProduct[]) => {
  if (skipped.length === 0) {
    return 'Todos os produtos entraram na exportação para o catálogo.\n'
  }

  const sections = (['pending', 'in-catalog'] as const).flatMap((kind) => {
    const lines = skipped
      .filter((product) => product.kind === kind)
      .map(
        ({ codes, name, reason }) => `${codes.join(', ')} · ${name}: ${reason}`
      )
    return lines.length === 0 ? [] : [[REPORT_SECTIONS[kind], '', ...lines]]
  })
  return `${sections.map((section) => section.join('\n')).join('\n\n')}\n`
}
