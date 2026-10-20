import type { Brand, PosterTemplate } from '@/domain/poster'

// Stand-ins until the brand settings (#11) store the brand and templates of each instance
export const DEFAULT_BRAND: Brand = {
  name: 'Supermercado Exemplo',
  logo: null,
  slogan: 'O menor preço da cidade',
  instagram: '@supermercadoexemplo'
}

export const DEFAULT_TEMPLATES: PosterTemplate[] = [
  {
    id: 'mercado',
    name: 'Mercado',
    colors: { primary: '#1a1d6b', accent: '#e01b22' }
  },
  {
    id: 'acougue',
    name: 'Açougue',
    colors: { primary: '#5c1310', accent: '#e01b22' }
  },
  {
    id: 'hortifruti',
    name: 'Hortifrúti',
    colors: { primary: '#14532d', accent: '#ea580c' }
  }
]
