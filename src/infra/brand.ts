import { asc } from 'drizzle-orm'

import type { BrandSettings, StoreBrand } from '@/domain/brand'
import type { PosterTemplate } from '@/domain/poster'
import type { Database } from '@/infra/database/relations'
import { brand, templates } from '@/infra/database/schema'

const BRAND_ID = 1

export const listTemplates = (database: Database): PosterTemplate[] =>
  database
    .select()
    .from(templates)
    .orderBy(asc(templates.position))
    .all()
    .map(({ id, name, primaryColor, accentColor }) => ({
      id,
      name,
      colors: { primary: primaryColor, accent: accentColor }
    }))

// Undefined until the first setup, which is what sends a new instance to the settings page
export const findBrandSettings = (
  database: Database
): BrandSettings | undefined => {
  const storeBrand = database
    .select({
      name: brand.name,
      slogan: brand.slogan,
      instagram: brand.instagram,
      logo: brand.logo,
      updatedAt: brand.updatedAt
    })
    .from(brand)
    .get()
  if (!storeBrand) return undefined

  return { brand: storeBrand, templates: listTemplates(database) }
}

// Templates are rewritten as a whole, like offer pages, so removing and reordering need no diff
export const saveBrandSettings = (
  database: Database,
  {
    brand: storeBrand,
    templates: newTemplates
  }: {
    brand: Omit<StoreBrand, 'updatedAt'>
    templates: PosterTemplate[]
  }
) =>
  database.transaction((transaction) => {
    const fields = { ...storeBrand, updatedAt: new Date() }
    transaction
      .insert(brand)
      .values({ id: BRAND_ID, ...fields })
      .onConflictDoUpdate({ target: brand.id, set: fields })
      .run()

    transaction.delete(templates).run()
    transaction
      .insert(templates)
      .values(
        newTemplates.map(({ id, name, colors }, position) => ({
          id,
          name,
          primaryColor: colors.primary,
          accentColor: colors.accent,
          position
        }))
      )
      .run()
  })
