import { cn } from 'cn'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'

import { AppLayout } from '@/app/components/layouts/app'
import { getPosterBrand } from '@/app/helpers/brand-poster'
import { getLegacyTabPath } from '@/app/helpers/navigation'
import { database } from '@/infra/database/client'
import { brandModel } from '@/models/brand/model'
import { catalogModel } from '@/models/catalog/model'
import { offerModel } from '@/models/offer/model'

import { FirstSetup } from './_components/first-setup'
import { OfferEditor } from './_components/offer-editor'

const MAIN_CLASS_NAME = 'flex w-full flex-1 flex-col px-4 py-10 sm:px-6'

export const generateMetadata = async (): Promise<Metadata> => {
  await connection()
  return {
    title: brandModel.findSettings(database)
      ? 'Oferta'
      : 'Configure a sua marca'
  }
}

const HomePage = async ({ searchParams }: PageProps<'/'>) => {
  // Renders per request, so `next build` never opens the database
  await connection()
  const { aba } = await searchParams
  const legacyPath = getLegacyTabPath(aba)
  if (legacyPath) redirect(legacyPath)

  const settings = brandModel.findSettings(database)

  // The first setup has no brand to show yet and nowhere else to go until it is saved
  if (!settings) {
    return (
      <main className={cn(MAIN_CLASS_NAME, 'items-center')}>
        <FirstSetup />
      </main>
    )
  }

  const { brand, templates } = settings

  return (
    <AppLayout brand={brand}>
      <main className={MAIN_CLASS_NAME}>
        <OfferEditor
          offer={offerModel.findOrCreate(database, templates[0].id)}
          backup={offerModel.findBackup(database)}
          brand={getPosterBrand(brand)}
          templates={templates}
          noEanImages={await catalogModel.listNoEanImages()}
        />
      </main>
    </AppLayout>
  )
}

export default HomePage
