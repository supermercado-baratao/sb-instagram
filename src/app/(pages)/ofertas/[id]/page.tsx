import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getPosterBrand } from '@/app/helpers/brand-poster'
import { requireBrandSettings } from '@/app/helpers/brand-settings'
import { database } from '@/infra/database/client'
import { findOffer } from '@/infra/offer'

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

  const { id, ...content } = offer
  return (
    <OfferEditor
      id={id}
      offer={content}
      brand={getPosterBrand(brand)}
      templates={templates}
    />
  )
}

export default OfferPage
