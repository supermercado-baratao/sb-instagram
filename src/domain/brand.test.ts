import { describe, expect, test } from 'vitest'

import {
  assignTemplateIds,
  type BrandContent,
  getBrandContentError,
  INITIAL_TEMPLATES,
  isBrandContent,
  normalizeInstagram,
  type TemplateDraft
} from './brand'

const colors = { primary: '#1a1d6b', accent: '#e01b22' }

const content = (changes: Partial<BrandContent> = {}): BrandContent => ({
  name: 'Supermercado Exemplo',
  slogan: '',
  instagram: '@exemplo',
  templates: INITIAL_TEMPLATES,
  ...changes
})

describe('normalizeInstagram', () => {
  test.each([
    ['exemplo', '@exemplo'],
    [' @exemplo ', '@exemplo'],
    ['@@exemplo', '@exemplo'],
    ['https://www.instagram.com/exemplo/', '@exemplo'],
    ['instagram.com/super.exemplo', '@super.exemplo'],
    ['  ', '']
  ])('%j becomes %j', (value, expected) => {
    expect(normalizeInstagram(value)).toBe(expected)
  })
})

describe('assignTemplateIds', () => {
  test('keeps the id of an existing template when it is renamed', () => {
    const drafts: TemplateDraft[] = [{ id: 'mercado', name: 'Geral', colors }]

    expect(assignTemplateIds(drafts)).toEqual([
      { id: 'mercado', name: 'Geral', colors }
    ])
  })

  test('derives a new id from the name, without accents', () => {
    const drafts: TemplateDraft[] = [
      { id: null, name: 'Padaria & Confeitaria', colors },
      { id: null, name: 'Açougue', colors }
    ]

    expect(assignTemplateIds(drafts).map(({ id }) => id)).toEqual([
      'padaria-confeitaria',
      'acougue'
    ])
  })

  test('adds a suffix when the id is taken', () => {
    const drafts: TemplateDraft[] = [
      { id: null, name: 'Mercado', colors },
      { id: 'mercado', name: 'Mercado', colors },
      { id: null, name: 'Mercado', colors }
    ]

    expect(assignTemplateIds(drafts).map(({ id }) => id)).toEqual([
      'mercado-2',
      'mercado',
      'mercado-3'
    ])
  })

  test('falls back to a generic id when the name has no letters or digits', () => {
    const drafts: TemplateDraft[] = [{ id: null, name: '!!!', colors }]

    expect(assignTemplateIds(drafts)[0].id).toBe('modelo')
  })
})

describe('isBrandContent', () => {
  test('accepts the form content', () => {
    expect(isBrandContent(content())).toBe(true)
  })

  test.each([
    ['no templates array', { ...content(), templates: undefined }],
    [
      'a template without colors',
      { ...content(), templates: [{ id: null, name: 'Mercado' }] }
    ],
    ['a missing name', { ...content(), name: undefined }]
  ])('rejects %s', (_, value) => {
    expect(isBrandContent(value)).toBe(false)
  })
})

describe('getBrandContentError', () => {
  test('accepts a store without slogan or Instagram', () => {
    expect(getBrandContentError(content({ instagram: '' }))).toBeUndefined()
  })

  test.each<[string, Partial<BrandContent>, string]>([
    ['an empty name', { name: '  ' }, 'name'],
    ['an invalid handle', { instagram: '@super mercado!' }, 'instagram'],
    ['no templates', { templates: [] }, 'templates'],
    [
      'a template without name',
      { templates: [{ id: null, name: ' ', colors }] },
      'templates'
    ],
    [
      'a template with an invalid color',
      {
        templates: [
          { id: null, name: 'Mercado', colors: { ...colors, accent: 'red' } }
        ]
      },
      'templates'
    ]
  ])('rejects %s', (_, changes, field) => {
    expect(getBrandContentError(content(changes))?.field).toBe(field)
  })
})
