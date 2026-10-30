'use server'

import {
  getPronunciationsError,
  isPronunciationList,
  normalizePronunciations,
  type Pronunciation,
  type PronunciationError
} from '@/domain/pronunciation'
import { database } from '@/infra/database/client'
import { savePronunciations } from '@/infra/pronunciation'

export type SaveVoiceSettingsResult =
  | { status: 'saved'; pronunciations: Pronunciation[] }
  | ({ status: 'error' } & Partial<PronunciationError> & { message: string })

export const saveVoiceSettingsAction = async (
  content: string
): Promise<SaveVoiceSettingsResult> => {
  let pronunciations: unknown
  try {
    pronunciations = JSON.parse(content)
  } catch {
    pronunciations = undefined
  }
  // A Server Action is a public endpoint, so the content is checked again here
  if (!isPronunciationList(pronunciations)) {
    return {
      status: 'error',
      message: 'Não foi possível salvar. Recarregue a página e tente de novo.'
    }
  }
  const error = getPronunciationsError(pronunciations)
  if (error) return { status: 'error', ...error }

  const normalized = normalizePronunciations(pronunciations)
  savePronunciations(database, normalized)
  return { status: 'saved', pronunciations: normalized }
}
