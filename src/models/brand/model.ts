import 'server-only'

import type { Database } from '@/infra/database/relations'
import { deleteLogo, readLogo as readLogoFile, saveLogo } from '@/infra/logo'
import { PHOTO_MAX_MEGABYTES } from '@/models/product/product'
import { brandRepo } from '@/repositories/brand-repo'

import {
  assignTemplateIds,
  type BrandContentError,
  type BrandSettings,
  getBrandContentError,
  normalizeInstagram
} from './brand'
import { brandContentSchema } from './schema'

// Undefined until the first setup, which is what sends a new instance to the settings page
const findSettings = (database: Database): BrandSettings | undefined =>
  brandRepo.findSettings(database)

const listTemplates = (database: Database) => brandRepo.listTemplates(database)

const readLogo = async (database: Database) => {
  if (!findSettings(database)?.brand.logo) return
  try {
    return await readLogoFile()
  } catch {
    return
  }
}

export type SaveBrandInput = {
  // The form's JSON, checked here, since a Server Action is a public endpoint
  content: unknown
  logo: File | undefined
  removeLogo: boolean
}

export type SaveBrandResult =
  | { status: 'saved'; settings: BrandSettings; firstSetup: boolean }
  | {
      status: 'invalid'
      field: BrandContentError['field'] | 'logo'
      message: string
    }

const save = async (
  database: Database,
  input: SaveBrandInput
): Promise<SaveBrandResult> => {
  const content = brandContentSchema.parse(input.content)
  const error = getBrandContentError(content)
  if (error) return { status: 'invalid', ...error }

  const upload = input.logo
  if (upload && upload.size > PHOTO_MAX_MEGABYTES * 1024 * 1024) {
    return {
      status: 'invalid',
      field: 'logo',
      message: `O logo precisa ter no máximo ${PHOTO_MAX_MEGABYTES} MB.`
    }
  }
  const removeLogo = !upload && input.removeLogo

  // The current logo comes from the server, never from the form
  const current = findSettings(database)
  let logo = current?.brand.logo ?? null
  if (upload) {
    try {
      logo = await saveLogo(Buffer.from(await upload.arrayBuffer()))
    } catch {
      return {
        status: 'invalid',
        field: 'logo',
        message:
          'Não foi possível ler o logo. Envie uma imagem PNG, JPG ou WebP.'
      }
    }
  } else if (removeLogo) {
    logo = null
  }

  brandRepo.saveSettings(database, {
    brand: {
      name: content.name.trim(),
      slogan: content.slogan.trim(),
      instagram: normalizeInstagram(content.instagram),
      logo
    },
    templates: assignTemplateIds(
      content.templates.map((template) => ({
        ...template,
        name: template.name.trim()
      }))
    )
  })
  if (removeLogo) await deleteLogo()

  const settings = findSettings(database)
  if (!settings) throw new Error('The brand was not saved')
  return { status: 'saved', settings, firstSetup: !current }
}

export const brandModel = {
  findSettings,
  listTemplates,
  readLogo,
  save
}
