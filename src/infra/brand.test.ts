// @vitest-environment node
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { describe, expect, test } from 'vitest'

import type { PosterTemplate } from '@/domain/poster'
import { migrationsFolder } from '@/infra/database/file'
import { relations } from '@/infra/database/relations'

import { findBrandSettings, listTemplates, saveBrandSettings } from './brand'

const templates: PosterTemplate[] = [
  {
    id: 'mercado',
    name: 'Mercado',
    colors: { primary: '#1c398e', accent: '#e7000b' }
  },
  {
    id: 'acougue',
    name: 'Açougue',
    colors: { primary: '#82181a', accent: '#e7000b' }
  }
]

const storeBrand = {
  name: 'Supermercado Exemplo',
  slogan: 'O menor preço da cidade',
  instagram: '@exemplo',
  logo: null
}

const setup = () => {
  const database = drizzle({ client: new Database(':memory:'), relations })
  migrate(database, { migrationsFolder })
  return database
}

describe('findBrandSettings', () => {
  test('returns nothing before the first setup', () => {
    expect(findBrandSettings(setup())).toBeUndefined()
  })
})

describe('saveBrandSettings', () => {
  test('saves the brand and the templates in order', () => {
    const database = setup()

    saveBrandSettings(database, {
      brand: storeBrand,
      templates
    })

    expect(findBrandSettings(database)).toEqual({
      brand: { ...storeBrand, updatedAt: expect.any(Date) },
      templates
    })
  })

  test('updates the single brand row and rewrites the templates', () => {
    const database = setup()
    saveBrandSettings(database, {
      brand: storeBrand,
      templates
    })
    const [mercado, acougue] = templates

    saveBrandSettings(database, {
      brand: { ...storeBrand, name: 'Mercado Novo', logo: 'logo.png' },
      templates: [acougue, { ...mercado, name: 'Geral' }]
    })

    expect(findBrandSettings(database)?.brand).toMatchObject({
      name: 'Mercado Novo',
      logo: 'logo.png'
    })
    expect(listTemplates(database)).toEqual([
      acougue,
      { ...mercado, name: 'Geral' }
    ])
  })
})
