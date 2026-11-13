// @vitest-environment node
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { describe, expect, test } from 'vitest'

import { migrationsFolder } from '@/infra/database/file'
import { relations } from '@/infra/database/relations'
import type { PosterTemplate } from '@/models/poster/poster'

import { brandModel } from './model'

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

const content = {
  name: ' Supermercado Exemplo ',
  slogan: 'O menor preço da cidade',
  instagram: 'exemplo',
  templates: templates.map((template) => ({ ...template, id: null }))
}

const save = (database: ReturnType<typeof setup>, value: unknown) =>
  brandModel.save(database, {
    content: value,
    logo: undefined,
    removeLogo: false
  })

describe('findSettings', () => {
  test('returns nothing before the first setup', () => {
    expect(brandModel.findSettings(setup())).toBeUndefined()
  })
})

describe('save', () => {
  test('saves the brand and the templates in order, with ids from their names', async () => {
    const database = setup()

    const result = await save(database, content)

    expect(result).toEqual({
      status: 'saved',
      firstSetup: true,
      settings: {
        brand: {
          ...storeBrand,
          instagram: '@exemplo',
          updatedAt: expect.any(Date)
        },
        templates
      }
    })
  })

  test('updates the single brand row, keeping the ids of the templates', async () => {
    const database = setup()
    await save(database, content)
    const [mercado, acougue] = templates

    const result = await save(database, {
      ...content,
      name: 'Mercado Novo',
      templates: [acougue, { ...mercado, name: 'Geral' }]
    })

    expect(result).toMatchObject({ status: 'saved', firstSetup: false })
    expect(brandModel.findSettings(database)?.brand.name).toBe('Mercado Novo')
    expect(brandModel.listTemplates(database)).toEqual([
      acougue,
      { ...mercado, name: 'Geral' }
    ])
  })

  test('answers the field to fix without saving', async () => {
    const database = setup()

    expect(await save(database, { ...content, name: ' ' })).toEqual({
      status: 'invalid',
      field: 'name',
      message: 'Informe o nome do mercado.'
    })
    expect(brandModel.findSettings(database)).toBeUndefined()
  })

  test("refuses content that is not the form's", async () => {
    await expect(
      save(setup(), { ...content, templates: undefined })
    ).rejects.toThrow()
  })
})
