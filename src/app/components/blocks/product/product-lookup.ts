import type { CatalogMatch, CodeType, Product } from '@/models/product/product'

export type ProductTarget =
  | { status: 'instance'; product: Product }
  | { status: 'catalog'; code: string; product: CatalogMatch }
  | { status: 'new'; code: string; codeType: CodeType }

export const getLookupMessage = (lookup: ProductTarget) => {
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
