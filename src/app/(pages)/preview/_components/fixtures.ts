import {
  type Brand,
  type Offer,
  type OfferProduct,
  type PosterTemplate
} from '@/models/poster/poster'

// The preview shows the poster art apart from any store, so it doesn't read the saved brand
export const brand: Brand = {
  name: 'Supermercado Exemplo',
  logo: null,
  slogan: 'O menor preço da cidade',
  instagram: '@supermercadoexemplo'
}

export const templates: PosterTemplate[] = [
  {
    id: 'mercado',
    name: 'Mercado',
    colors: { primary: '#1c398e', accent: '#e7000b' }
  },
  {
    id: 'acougue',
    name: 'Açougue',
    colors: { primary: '#82181a', accent: '#e7000b' }
  },
  {
    id: 'hortifruti',
    name: 'Hortifrúti',
    colors: { primary: '#0d542b', accent: '#e7000b' }
  }
]

export const offer: Offer = {
  validUntil: '20/10/2026',
  highlightTitle: 'Ofertas da semana',
  highlightMessage: 'Só nesta loja'
}

const product = (
  code: string,
  description: string,
  unit: string,
  priceInCents: number
): OfferProduct => ({
  code,
  codeType: 'internal',
  description,
  unit,
  image: null,
  priceInCents
})

export const products: OfferProduct[] = [
  product('1', 'Arroz tipo 1 Camil', '5Kg', 2398),
  product('2', 'Feijão carioca Kicaldo', '1Kg', 789),
  product(
    '3',
    'Refrigerante de cola sabor original garrafa retornável Coca-Cola',
    '2L',
    1099
  ),
  product('4', 'Picanha bovina', 'Kg', 6990),
  product('5', 'Açúcar refinado União', '1Kg', 549),
  product('6', 'Café torrado e moído', '500g', 1890),
  product('7', 'Óleo de soja Liza', '900ml', 799),
  product('8', '', '', 0),
  product('9', 'Macarrão espaguete Renata Superiore Grano Duro', '500g', 105),
  product('10', 'Leite integral Italac', '1L', 489),
  product('11', 'Sabão em pó Omo lavagem perfeita', '1,6Kg', 2790),
  product('12', 'Banana prata', 'Kg', 599)
]
