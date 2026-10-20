'use server'

import { redirect } from 'next/navigation'

import { getLogoUrl } from '@/app/helpers/brand-poster'
import {
  assignTemplateIds,
  type BrandContentError,
  getBrandContentError,
  isBrandContent,
  normalizeInstagram
} from '@/domain/brand'
import type { PosterTemplate } from '@/domain/poster'
import { PHOTO_MAX_MEGABYTES } from '@/domain/product'
import { findBrandSettings, saveBrandSettings } from '@/infra/brand'
import { database } from '@/infra/database/client'
import { deleteLogo, saveLogo } from '@/infra/logo'

export type SaveBrandResult =
  | { status: 'saved'; logoUrl: string | null; templates: PosterTemplate[] }
  | {
      status: 'error'
      field?: BrandContentError['field'] | 'logo'
      message: string
    }

const parseContent = (formData: FormData) => {
  const value = formData.get('content')
  if (typeof value !== 'string') return
  try {
    const content: unknown = JSON.parse(value)
    return isBrandContent(content) ? content : undefined
  } catch {
    return
  }
}

const readUpload = (formData: FormData) => {
  const file = formData.get('logo')
  return file instanceof File && file.size > 0 ? file : undefined
}

export const saveBrandSettingsAction = async (
  formData: FormData
): Promise<SaveBrandResult> => {
  const content = parseContent(formData)
  if (!content) {
    return {
      status: 'error',
      message: 'Não foi possível salvar. Recarregue a página e tente de novo.'
    }
  }
  const error = getBrandContentError(content)
  if (error) return { status: 'error', ...error }

  const upload = readUpload(formData)
  if (upload && upload.size > PHOTO_MAX_MEGABYTES * 1024 * 1024) {
    return {
      status: 'error',
      field: 'logo',
      message: `O logo precisa ter no máximo ${PHOTO_MAX_MEGABYTES} MB.`
    }
  }
  const removeLogo = !upload && formData.get('removeLogo') === 'true'

  // The current logo comes from the server, never from the form
  const current = findBrandSettings(database)
  let logo = current?.brand.logo ?? null
  if (upload) {
    try {
      logo = await saveLogo(Buffer.from(await upload.arrayBuffer()))
    } catch {
      return {
        status: 'error',
        field: 'logo',
        message:
          'Não foi possível ler o logo. Envie uma imagem PNG, JPG ou WebP.'
      }
    }
  } else if (removeLogo) {
    logo = null
  }

  saveBrandSettings(database, {
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

  // The first setup came from a page that needed the brand, so it goes on to the offers
  if (!current) redirect('/ofertas')

  // New templates got their ids on the server, so the form takes them back to keep them on the
  // next save
  const saved = findBrandSettings(database)
  return {
    status: 'saved',
    logoUrl: saved ? getLogoUrl(saved.brand) : null,
    templates: saved?.templates ?? []
  }
}
