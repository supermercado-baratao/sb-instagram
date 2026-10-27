import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppLayout } from '@/app/components/layouts/app'
import { getPosterBrand } from '@/app/helpers/brand-poster'
import { requireBrandSettings } from '@/app/helpers/brand-settings'
import { database } from '@/infra/database/client'
import { findOffer } from '@/infra/offer'
import { listNoEanImages } from '@/infra/photo'

import { OfferEditor } from './_components/offer-editor'

const findOfferByParams = async (params: Promise<{ id: string }>) => {
  const { id } = await params
  return findOffer(database, Number(id))
}

export const generateMetadata = async ({
  params
}: PageProps<'/ofertas/[id]'>): Promise<Metadata> => {
  const offer = await findOfferByParams(params)
  return { title: offer ? offer.name : 'Oferta' }
}

const OfferPage = async ({ params }: PageProps<'/ofertas/[id]'>) => {
  const { brand, templates } = requireBrandSettings()
  const offer = await findOfferByParams(params)
  if (!offer) notFound()
  const noEanImages = await listNoEanImages()

  const { id, ...content } = offer
  return (
    <AppLayout brand={brand}>
      <OfferEditor
        id={id}
        offer={content}
        brand={getPosterBrand(brand)}
        templates={templates}
        noEanImages={noEanImages}
      />
    </AppLayout>
  )
}

export default OfferPage
