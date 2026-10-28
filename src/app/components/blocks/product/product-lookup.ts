import { getCatalogPhotoUrl, getPhotoUrl } from '@/app/helpers/product-photo'
import type { CatalogMatch, CodeType, Product } from '@/domain/product'

export type ProductTarget =
  | { status: 'instance'; product: Product }
  | { status: 'catalog'; code: string; product: CatalogMatch }
  | { status: 'new'; code: string; codeType: CodeType }

export type ProductLookup = ProductTarget & {
  id: number
}

export const getLookupMessage = (lookup: ProductLookup) => {
  switch (lookup.status) {
    case 'new': {
      return lookup.codeType === 'ean'
        ? 'Produto novo. Preencha os dados para cadastrar.'
        : 'Código interno novo. Preencha os dados e escolha uma imagem do catálogo ou envie uma foto.'
    }
    case 'catalog': {
      return 'Produto encontrado no catálogo da comunidade. Confira os dados e salve para usar.'
    }
    case 'instance': {
      return lookup.product.codes.length > 1
        ? `Produto já cadastrado, com ${lookup.product.codes.length} códigos. Altere o que precisar e salve.`
        : 'Produto já cadastrado. Altere o que precisar e salve.'
    }
  }
}

export const getProductFormProps = (lookup: ProductLookup) => {
  switch (lookup.status) {
    case 'new': {
      return { codes: [lookup.code] }
    }
    case 'catalog': {
      return {
        codes: lookup.product.codes,
        product: lookup.product,
        photoUrl: getCatalogPhotoUrl(lookup.product.ean),
        catalogEan: lookup.product.ean
      }
    }
    case 'instance': {
      const { product } = lookup
      return {
        productId: product.id,
        codes: product.codes,
        product,
        photoUrl: product.photo ? getPhotoUrl(product.id, lookup.id) : undefined
      }
    }
  }
}
