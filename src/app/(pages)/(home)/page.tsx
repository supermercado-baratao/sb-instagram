import { cn } from 'cn'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'

import { BrandSettingsForm } from '@/app/components/blocks/brand/brand-settings-form'
import { AppLayout } from '@/app/components/layouts/app'
import { getPosterBrand } from '@/app/helpers/brand-poster'
import { getLegacyTabPath } from '@/app/helpers/navigation'
import { createBrandContent } from '@/domain/brand'
import { findBrandSettings } from '@/infra/brand'
import { database } from '@/infra/database/client'
import { findOfferBackup, findOrCreateOffer } from '@/infra/offer'
import { listNoEanImages } from '@/infra/photo'

import { OfferEditor } from './_components/offer-editor'

const MAIN_CLASS_NAME = 'flex w-full flex-1 flex-col px-4 py-10 sm:px-6'

export const generateMetadata = async (): Promise<Metadata> => {
  await connection()
  return {
    title: findBrandSettings(database) ? 'Oferta' : 'Configure a sua marca'
  }
}

const HomePage = async ({ searchParams }: PageProps<'/'>) => {
  // Renders per request, so `next build` never opens the database
  await connection()
  const { aba } = await searchParams
  const legacyPath = getLegacyTabPath(aba)
  if (legacyPath) redirect(legacyPath)

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

  const { brand, templates } = settings

  return (
    <AppLayout brand={brand}>
      <main className={MAIN_CLASS_NAME}>
        <OfferEditor
          offer={findOrCreateOffer(database, templates[0].id)}
          backup={findOfferBackup(database)}
          brand={getPosterBrand(brand)}
          templates={templates}
          noEanImages={await listNoEanImages()}
        />
      </main>
    </AppLayout>
  )
}

export default HomePage
