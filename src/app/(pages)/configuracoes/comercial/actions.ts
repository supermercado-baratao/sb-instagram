'use server'

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
  type RadioScriptTemplate
} from '@/domain/radio-script'
import { database } from '@/infra/database/client'
import { savePronunciations } from '@/infra/pronunciation'
import { saveRadioScriptTemplate } from '@/infra/radio-script'

export type SaveVoiceSettingsResult =
  | {
      status: 'saved'
      pronunciations: Pronunciation[]
      radioScript: RadioScriptTemplate
    }
  | ({ status: 'error' } & Partial<PronunciationError> & {
        message: string
        radioScriptError?: boolean
        radioScriptIndex?: number
      })

export const saveVoiceSettingsAction = async (
  content: string
): Promise<SaveVoiceSettingsResult> => {
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
      radioScriptError: true,
      radioScriptIndex: radioScriptError.index
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
  return {
    status: 'saved',
    pronunciations: normalized,
    radioScript: template
  }
}
