'use server'

import { revalidatePath } from 'next/cache'

import {
  OFFER_PATH,
  PRODUCTS_PATH,
  RADIO_AD_PATH
} from '@/app/helpers/navigation'
import {
  getPronunciationsError,
  isPronunciationList,
  normalizePronunciations,
  type Pronunciation,
  type PronunciationError
} from '@/domain/pronunciation'
import {
  getRadioScriptTemplateError,
  isRadioScriptTemplate,
  normalizeRadioScriptTemplate,
  type RadioScriptClosingField,
  type RadioScriptTemplate
} from '@/domain/radio-script'
import { type ActionError, runAction } from '@/entry/action'
import { database } from '@/infra/database/client'
import { savePronunciations } from '@/infra/pronunciation'
import { saveRadioScriptTemplate } from '@/infra/radio-script'
import { productModel } from '@/models/product/model'
import type { Product } from '@/models/product/product'

export type SaveRadioAdResult =
  | {
      status: 'saved'
      pronunciations: Pronunciation[]
      radioScript: RadioScriptTemplate
    }
  | ({ status: 'error' } & Partial<PronunciationError> & {
        message: string
        closingIndex?: number
        closingField?: RadioScriptClosingField
      })

export const saveRadioAdAction = async (
  content: string
): Promise<SaveRadioAdResult> => {
  let settings: unknown
  try {
    settings = JSON.parse(content)
  } catch {
    settings = undefined
  }
  const { pronunciations, radioScript } =
    typeof settings === 'object' && settings !== null
      ? (settings as Record<string, unknown>)
      : {}
  // A Server Action is a public endpoint, so the content is checked again here
  if (
    !isPronunciationList(pronunciations) ||
    !isRadioScriptTemplate(radioScript)
  ) {
    return {
      status: 'error',
      message: 'Não foi possível salvar. Recarregue a página e tente de novo.'
    }
  }
  const radioScriptError = getRadioScriptTemplateError(radioScript)
  if (radioScriptError) {
    return {
      status: 'error',
      message: radioScriptError.message,
      closingIndex: radioScriptError.index,
      closingField: radioScriptError.field
    }
  }
  const error = getPronunciationsError(pronunciations)
  if (error) return { status: 'error', ...error }

  const normalized = normalizePronunciations(pronunciations)
  const template = normalizeRadioScriptTemplate(radioScript)
  database.transaction((transaction) => {
    savePronunciations(transaction, normalized)
    saveRadioScriptTemplate(transaction, template)
  })
  // A page keeps its old content for the browser's Back button, and saving that again would undo this
  revalidatePath(RADIO_AD_PATH)
  return {
    status: 'saved',
    pronunciations: normalized,
    radioScript: template
  }
}

export type SaveVoiceTextResult =
  ActionError | { status: 'saved'; product: Product }

// Saved at once, apart from the tab's own "Salvar", since it belongs to the product, like the
// product dialog of the offer editor (#111)
export const saveProductVoiceTextAction = async (
  id: unknown,
  voiceText: unknown
): Promise<SaveVoiceTextResult> =>
  runAction(
    {
      fallback: 'Não foi possível salvar. Tente de novo.',
      invalid: 'Não foi possível salvar. Recarregue a página e tente de novo.'
    },
    () => {
      const product = productModel.saveVoiceText(database, { id, voiceText })
      revalidatePath(RADIO_AD_PATH)
      revalidatePath(OFFER_PATH)
      revalidatePath(PRODUCTS_PATH)
      return { status: 'saved' as const, product }
    }
  )
