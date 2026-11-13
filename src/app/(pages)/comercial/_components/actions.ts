'use server'

import { revalidatePath } from 'next/cache'

import {
  OFFER_PATH,
  PRODUCTS_PATH,
  RADIO_AD_PATH
} from '@/app/helpers/navigation'
import { type ActionError, runAction } from '@/entry/action'
import { database } from '@/infra/database/client'
import { productModel } from '@/models/product/model'
import type { Product } from '@/models/product/product'
import {
  radioAdModel,
  type SaveRadioAdResult as RadioAdResult
} from '@/models/radio-ad/model'

export type SaveRadioAdResult =
  | Extract<RadioAdResult, { status: 'saved' }>
  | (Omit<Extract<RadioAdResult, { status: 'invalid' }>, 'status'> & {
      status: 'error'
    })

export const saveRadioAdAction = async (
  content: string
): Promise<SaveRadioAdResult> =>
  runAction(
    {
      fallback: 'Não foi possível salvar. Tente de novo.',
      invalid: 'Não foi possível salvar. Recarregue a página e tente de novo.'
    },
    (): SaveRadioAdResult => {
      let settings: unknown
      try {
        settings = JSON.parse(content)
      } catch {
        settings = undefined
      }
      const result = radioAdModel.save(database, settings)
      if (result.status === 'invalid') return { ...result, status: 'error' }
      // A page keeps its old content for the browser's Back button, and saving that again would
      // undo this
      revalidatePath(RADIO_AD_PATH)
      return result
    }
  )

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
