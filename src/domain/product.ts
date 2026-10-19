import { isValidEan } from '@/domain/ean'

export const CODE_TYPES = ['ean', 'internal'] as const

export type CodeType = (typeof CODE_TYPES)[number]

export type Product = {
  code: string
  codeType: CodeType
  name: string
  brand: string | null
  unit: string | null
  photo: string | null
}

export type ProductSource = 'instance' | 'catalog'

export type FoundProduct = {
  product: Product
  source: ProductSource
}

// USB scanners and copy-paste may bring surrounding or inner spaces, which a code never has
export const normalizeCode = (code: string) => code.replaceAll(/\s/g, '')

export const getCodeType = (code: string): CodeType =>
  isValidEan(code) ? 'ean' : 'internal'
