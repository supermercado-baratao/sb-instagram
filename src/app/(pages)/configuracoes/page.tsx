import type { Metadata } from 'next'
import { connection } from 'next/server'

import { getLogoUrl } from '@/app/helpers/brand-poster'
import { createBrandContent } from '@/domain/brand'
import { findBrandSettings } from '@/infra/brand'
import { database } from '@/infra/database/client'

import { BrandSettingsForm } from './_components/brand-settings-form'

export const metadata: Metadata = {
  title: 'Configurações da marca'
}

const SettingsPage = async () => {
  // Renders per request, so `next build` never opens the database
  await connection()
  const settings = findBrandSettings(database)

  return (
    <BrandSettingsForm
      firstSetup={!settings}
      initialContent={createBrandContent(settings)}
      initialLogoUrl={settings ? getLogoUrl(settings.brand) : null}
    />
  )
}

export default SettingsPage
