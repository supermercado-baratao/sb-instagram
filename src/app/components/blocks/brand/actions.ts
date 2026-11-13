'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getLogoUrl } from '@/app/helpers/brand-poster'
import type { PosterTemplate } from '@/domain/poster'
import { runAction } from '@/entry/action'
import { database } from '@/infra/database/client'
import type { BrandContentError } from '@/models/brand/brand'
import { brandModel } from '@/models/brand/model'

export type SaveBrandResult =
  | { status: 'saved'; logoUrl: string | null; templates: PosterTemplate[] }
  | {
      status: 'error'
      field?: BrandContentError['field'] | 'logo'
      message: string
    }

const parseContent = (formData: FormData): unknown => {
  const value = formData.get('content')
  if (typeof value !== 'string') return
  try {
    return JSON.parse(value)
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
): Promise<SaveBrandResult> =>
  runAction(
    {
      fallback: 'Não foi possível salvar. Tente de novo.',
      invalid: 'Não foi possível salvar. Recarregue a página e tente de novo.'
    },
    async (): Promise<SaveBrandResult> => {
      const result = await brandModel.save(database, {
        content: parseContent(formData),
        logo: readUpload(formData),
        removeLogo: formData.get('removeLogo') === 'true'
      })
      if (result.status === 'invalid') {
        return { status: 'error', field: result.field, message: result.message }
      }

      // The first setup came from a page that needed the brand, so it goes on to the offers
      if (result.firstSetup) redirect('/')

      // The header of every page shows the brand name and logo, and a page keeps its old content
      // for the browser's Back button, where saving it again would undo this
      revalidatePath('/', 'layout')

      // New templates got their ids on the server, so the form takes them back to keep them on
      // the next save
      const { brand, templates } = result.settings
      return { status: 'saved', logoUrl: getLogoUrl(brand), templates }
    }
  )
