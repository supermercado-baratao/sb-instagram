import type { Metadata } from 'next'
import { connection } from 'next/server'

import { AppLayout } from '@/app/components/layouts/app'
import { getLogoUrl } from '@/app/helpers/brand-poster'
import { SETTINGS_PATH } from '@/app/helpers/brand-settings'
import { createBrandContent } from '@/domain/brand'
import { findBrandSettings } from '@/infra/brand'
import { database } from '@/infra/database/client'

import { BrandSettingsForm } from './_components/brand-settings-form'
import { SettingsNav } from './_components/settings-nav'

export const generateMetadata = async (): Promise<Metadata> => {
  await connection()
  return {
    title: findBrandSettings(database) ? 'Marca' : 'Configure a sua marca'
  }
}

const SettingsPage = async () => {
  // Renders per request, so `next build` never opens the database
  await connection()
  const settings = findBrandSettings(database)

  const form = (
    <BrandSettingsForm
      firstSetup={!settings}
      initialContent={createBrandContent(settings)}
      initialLogoUrl={settings ? getLogoUrl(settings.brand) : null}
      nav={settings && <SettingsNav current={SETTINGS_PATH} />}
    />
  )

  // The first setup has no brand to show yet and nowhere else to go until it is saved
  return settings ? <AppLayout brand={settings.brand}>{form}</AppLayout> : form
}

export default SettingsPage
