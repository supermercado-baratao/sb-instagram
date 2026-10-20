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

// A new instance starts with these, so an offer can be created right after the first setup
export const INITIAL_TEMPLATES: PosterTemplate[] = [
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

export const createBrandContent = (settings?: BrandSettings): BrandContent => ({
  name: settings?.brand.name ?? '',
  slogan: settings?.brand.slogan ?? '',
  instagram: settings?.brand.instagram ?? '',
  templates: settings?.templates ?? INITIAL_TEMPLATES
})

export const LOGO_FILE_NAME = 'logo.png'

// The poster shows the logo at most 230 px wide, so 600 px keeps a 2x margin
export const LOGO_MAX_SIDE = 600

const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i

export const isHexColor = (value: string) => HEX_COLOR_PATTERN.test(value)

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

export const isInstagramHandle = (value: string) =>
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isTemplateDraft = (value: unknown): value is TemplateDraft =>
  isRecord(value) &&
  (value.id === null || typeof value.id === 'string') &&
  typeof value.name === 'string' &&
  isRecord(value.colors) &&
  typeof value.colors.primary === 'string' &&
  typeof value.colors.accent === 'string'

// A Server Action is a public endpoint, so the form's content is checked again on the server
export const isBrandContent = (value: unknown): value is BrandContent =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  typeof value.slogan === 'string' &&
  typeof value.instagram === 'string' &&
  Array.isArray(value.templates) &&
  value.templates.every(isTemplateDraft)

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
