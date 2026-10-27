import type { LookupResult } from './actions'

export type ProductLookup = Exclude<LookupResult, { status: 'error' }> & {
  id: number
}

export const getLookupMessage = (lookup: ProductLookup) => {
  if (lookup.status === 'new') {
    return lookup.codeType === 'ean'
      ? 'Produto novo. Preencha os dados para cadastrar.'
      : 'Código interno novo. Preencha os dados e escolha uma imagem do catálogo ou envie uma foto.'
  }
  if (lookup.matchedCode !== lookup.product.code) {
    return `O código ${lookup.matchedCode} é um dos outros códigos deste produto. Altere o que precisar e salve.`
  }
  return lookup.source === 'instance'
    ? 'Produto já cadastrado. Altere o que precisar e salve.'
    : 'Produto encontrado no catálogo da comunidade. Confira os dados e salve para usar.'
}

export const getProductFormProps = (lookup: ProductLookup) => ({
  code: lookup.status === 'new' ? lookup.code : lookup.product.code,
  product: lookup.status === 'found' ? lookup.product : undefined,
  extraCodes: lookup.status === 'found' ? lookup.extraCodes : undefined,
  hasPhoto:
    lookup.status === 'found' &&
    (lookup.source === 'catalog' || lookup.product.photo !== null),
  photoVersion: lookup.id
})
