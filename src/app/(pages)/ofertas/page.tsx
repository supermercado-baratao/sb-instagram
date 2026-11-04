import type { Metadata } from 'next'
import { connection } from 'next/server'

import { AppLayout } from '@/app/components/layouts/app'
import { getPosterBrand } from '@/app/helpers/brand-poster'
import { requireBrandSettings } from '@/app/helpers/brand-settings'
import { database } from '@/infra/database/client'
import { findOrCreateOffer, OFFER_ID } from '@/infra/offer'
import { listOfferGenerations } from '@/infra/offer-generation'
import { listNoEanImages } from '@/infra/photo'

import { OfferEditor } from './_components/offer-editor'

export const metadata: Metadata = { title: 'Oferta' }

const OfferPage = async () => {
  await connection()
  const { brand, templates } = requireBrandSettings()
  const offer = findOrCreateOffer(database, templates[0].id)
  const noEanImages = await listNoEanImages()

  return (
    <AppLayout brand={brand} wide>
      <OfferEditor
        offer={offer}
        brand={getPosterBrand(brand)}
        templates={templates}
        noEanImages={noEanImages}
        generations={listOfferGenerations(database, OFFER_ID)}
      />
    </AppLayout>
  )
}

export default OfferPage
