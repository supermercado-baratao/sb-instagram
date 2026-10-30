import type { Metadata } from 'next'
import { connection } from 'next/server'

import { AppLayout } from '@/app/components/layouts/app'
import {
  requireBrandSettings,
  VOICE_SETTINGS_PATH
} from '@/app/helpers/brand-settings'
import { database } from '@/infra/database/client'
import { listPronunciations } from '@/infra/pronunciation'

import { SettingsNav } from '../_components/settings-nav'
import { VoiceSettingsForm } from './_components/voice-settings-form'

export const metadata: Metadata = { title: 'Comercial' }

const VoiceSettingsPage = async () => {
  // Renders per request, so `next build` never opens the database
  await connection()
  const { brand } = requireBrandSettings()

  return (
    <AppLayout brand={brand}>
      <VoiceSettingsForm
        nav={<SettingsNav current={VOICE_SETTINGS_PATH} />}
        initialPronunciations={listPronunciations(database)}
      />
    </AppLayout>
  )
}

export default VoiceSettingsPage
