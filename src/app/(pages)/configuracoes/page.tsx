import type { Metadata } from 'next'
import { connection } from 'next/server'

import { BrandSettingsForm } from '@/app/components/blocks/brand/brand-settings-form'
import { AppLayout } from '@/app/components/layouts/app'
import { getLogoUrl } from '@/app/helpers/brand-poster'
import { BRAND_SETTINGS_PATH } from '@/app/helpers/navigation'
import { requireBrandSettings } from '@/entry/brand'
import { createBrandContent } from '@/models/brand/brand'

import { SettingsTabs } from './_components/settings-tabs'

export const metadata: Metadata = { title: 'Marca' }

const BrandSettingsPage = async () => {
  await connection()
  const settings = requireBrandSettings()

  return (
    <AppLayout brand={settings.brand}>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-10 sm:px-6">
        <SettingsTabs current={BRAND_SETTINGS_PATH}>
          <BrandSettingsForm
            firstSetup={false}
            initialContent={createBrandContent(settings)}
            initialLogoUrl={getLogoUrl(settings.brand)}
          />
        </SettingsTabs>
      </main>
    </AppLayout>
  )
}

export default BrandSettingsPage
