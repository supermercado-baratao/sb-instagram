import type { PosterTemplate } from '@/domain/poster'

export type StoreBrand = {
  name: string
  slogan: string
  instagram: string
  // File name inside the data directory, or null while the store has no logo
  logo: string | null
  updatedAt: Date
}

export type BrandSettings = {
  brand: StoreBrand
  templates: PosterTemplate[]
}

// A template added in the settings form has no id until the server assigns one
export type TemplateDraft = Omit<PosterTemplate, 'id'> & { id: string | null }

export type BrandContent = {
  name: string
  slogan: string
  instagram: string
  templates: TemplateDraft[]
}

// A new instance starts with one template, so an offer can be created right after the first
// setup. Its colors are generic (Tailwind's blue-900 and red-600) because each store sets its
// own in the form, and nothing store-specific is hardcoded (#102)
export const INITIAL_TEMPLATE: PosterTemplate = {
  id: 'padrao',
  name: 'Padrão',
  colors: { primary: '#1c398e', accent: '#e7000b' }
}

export const createBrandContent = (settings?: BrandSettings): BrandContent => ({
  name: settings?.brand.name ?? '',
  slogan: settings?.brand.slogan ?? '',
  instagram: settings?.brand.instagram ?? '',
  templates: settings?.templates ?? [INITIAL_TEMPLATE]
})

const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i

const isHexColor = (value: string) => HEX_COLOR_PATTERN.test(value)

// Brand manuals list colors as "#1A1D6B" or "1a1d6b", and people paste them with spaces
export const normalizeHexColor = (value: string) => {
  const color = `#${value.trim().replace(/^#/, '')}`.toLowerCase()
  return isHexColor(color) ? color : undefined
}

// Instagram usernames: letters, digits, periods and underscores, up to 30 characters
const INSTAGRAM_HANDLE_PATTERN = /^@[\w.]{1,30}$/

// People paste the handle with or without "@", or the whole profile URL
export const normalizeInstagram = (value: string) => {
  const handle = value
    .replaceAll(/\s/g, '')
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '')
    .replace(/\/$/, '')
    .replace(/^@+/, '')
  return handle === '' ? '' : `@${handle}`
}

const isInstagramHandle = (value: string) =>
  INSTAGRAM_HANDLE_PATTERN.test(value)

const FALLBACK_TEMPLATE_ID = 'modelo'

const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z\d]+/g, '-')
    .replaceAll(/^-|-$/g, '')

// Offer pages keep the template id, so an existing template keeps its id when it is renamed
export const assignTemplateIds = (
  templates: TemplateDraft[]
): PosterTemplate[] => {
  const taken = new Set(
    templates.flatMap((template) => (template.id ? [template.id] : []))
  )
  return templates.map((template) => {
    if (template.id) return { ...template, id: template.id }

    const base = slugify(template.name) || FALLBACK_TEMPLATE_ID
    let id = base
    for (let suffix = 2; taken.has(id); suffix++) id = `${base}-${suffix}`
    taken.add(id)
    return { ...template, id }
  })
}

export type BrandContentError = {
  field: 'name' | 'instagram' | 'templates'
  message: string
}

export const getBrandContentError = (
  content: BrandContent
): BrandContentError | undefined => {
  if (content.name.trim() === '') {
    return { field: 'name', message: 'Informe o nome do mercado.' }
  }
  const instagram = normalizeInstagram(content.instagram)
  if (instagram !== '' && !isInstagramHandle(instagram)) {
    return {
      field: 'instagram',
      message:
        'O @ do Instagram só pode ter letras, números, ponto e sublinhado, até 30 caracteres.'
    }
  }
  if (content.templates.length === 0) {
    return { field: 'templates', message: 'Crie pelo menos um modelo.' }
  }
  if (content.templates.some((template) => template.name.trim() === '')) {
    return { field: 'templates', message: 'Dê um nome para cada modelo.' }
  }
  if (
    content.templates.some(
      ({ colors }) => !isHexColor(colors.primary) || !isHexColor(colors.accent)
    )
  ) {
    return {
      field: 'templates',
      message: 'Escolha as duas cores de cada modelo.'
    }
  }
}
