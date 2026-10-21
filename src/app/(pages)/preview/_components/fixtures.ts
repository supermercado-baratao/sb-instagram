import type { Brand, Offer, OfferProduct } from '@/domain/poster'

// The preview shows the poster art apart from any store, so it doesn't read the saved brand
export const brand: Brand = {
  name: 'Supermercado Exemplo',
  logo: null,
  slogan: 'O menor preço da cidade',
  instagram: '@supermercadoexemplo'
}

export { INITIAL_TEMPLATES as templates } from '@/domain/brand'

export const offer: Offer = {
  validUntil: '20/10/2026',
  highlightTitle: 'Ofertas da semana',
  highlightMessage: 'Só nesta loja'
}

const product = (
  code: string,
  name: string,
  brand: string,
  unit: string,
  priceInCents: number
): OfferProduct => ({
  code,
  codeType: 'internal',
  name,
  brand,
  unit,
  image: null,
  priceInCents
})

export const products: OfferProduct[] = [
  product('1', 'Arroz tipo 1', 'Camil', '5Kg', 2398),
  product('2', 'Feijão carioca', 'Kicaldo', '1Kg', 789),
  product(
    '3',
    'Refrigerante de cola sabor original garrafa retornável',
    'Coca-Cola',
    '2L',
    1099
  ),
  product('4', '-', 'Picanha bovina', 'Kg', 6990),
  product('5', 'Leite integral', 'Italac', '1L', 549),
  product('6', 'Café torrado e moído', '', '500g', 1890),
  product('7', 'Óleo de soja', 'Liza', '900ml', 799),
  product('8', '', '', '', 0),
  product('9', 'Macarrão espaguete', 'Renata Superiore Grano Duro', '500g', 105)
]
