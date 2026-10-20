import { redirect } from 'next/navigation'

import { findBrandSettings } from '@/infra/brand'
import { database } from '@/infra/database/client'

export const SETTINGS_PATH = '/configuracoes'

// A new instance has no brand yet, so every page that needs it starts the guided first setup
export const requireBrandSettings = () =>
  findBrandSettings(database) ?? redirect(SETTINGS_PATH)
