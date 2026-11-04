import { cn } from 'cn'
import type { Metadata } from 'next'
import { connection } from 'next/server'

import { AppLayout } from '@/app/components/layouts/app'
import { getLogoUrl, getPosterBrand } from '@/app/helpers/brand-poster'
import { type HomeTabId, parseHomeTab } from '@/app/helpers/home-tabs'
import type { BrandSettings } from '@/domain/brand'
import { createBrandContent } from '@/domain/brand'
import { findBrandSettings } from '@/infra/brand'
import { database } from '@/infra/database/client'
import { findOrCreateOffer } from '@/infra/offer'
import { listNoEanImages } from '@/infra/photo'
import { listPronunciations } from '@/infra/pronunciation'
import { findRadioScriptTemplate } from '@/infra/radio-script'

import { BrandSettingsForm } from './_components/brand/brand-settings-form'
import { HomeTabs } from './_components/home-tabs'
import { OfferEditor } from './_components/offer/offer-editor'
import { VoiceSettingsForm } from './_components/voice/voice-settings-form'

const MAIN_CLASS_NAME = 'flex w-full flex-1 flex-col px-4 py-10 sm:px-6'

export const generateMetadata = async ({
  searchParams
}: PageProps<'/'>): Promise<Metadata> => {
  await connection()
  if (!findBrandSettings(database)) return { title: 'Configure a sua marca' }
  const { aba } = await searchParams
  return { title: parseHomeTab(aba).label }
}

const renderTab = async (id: HomeTabId, settings: BrandSettings) => {
  const { brand, templates } = settings
  switch (id) {
    case 'oferta': {
      return (
        <OfferEditor
          offer={findOrCreateOffer(database, templates[0].id)}
          brand={getPosterBrand(brand)}
          templates={templates}
          noEanImages={await listNoEanImages()}
        />
      )
    }
    case 'marca': {
      return (
        <BrandSettingsForm
          firstSetup={false}
          initialContent={createBrandContent(settings)}
          initialLogoUrl={getLogoUrl(brand)}
        />
      )
    }
    case 'comercial': {
      return (
        <VoiceSettingsForm
          initialPronunciations={listPronunciations(database)}
          initialRadioScript={findRadioScriptTemplate(database)}
        />
      )
    }
  }
}

const HomePage = async ({ searchParams }: PageProps<'/'>) => {
  // Renders per request, so `next build` never opens the database
  await connection()
  const settings = findBrandSettings(database)

  // The first setup has no brand to show yet and nowhere else to go until it is saved
  if (!settings) {
    return (
      <main className={cn(MAIN_CLASS_NAME, 'items-center')}>
        <BrandSettingsForm
          firstSetup
          initialContent={createBrandContent()}
          initialLogoUrl={null}
        />
      </main>
    )
  }

  const { aba } = await searchParams
  const { id } = parseHomeTab(aba)

  return (
    <AppLayout brand={settings.brand} wide>
      <main className={MAIN_CLASS_NAME}>
        <HomeTabs current={id}>{await renderTab(id, settings)}</HomeTabs>
      </main>
    </AppLayout>
  )
}

export default HomePage
