import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { DEFAULT_BRAND, DEFAULT_TEMPLATES } from '@/domain/poster-defaults'
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
  const offer = await findOfferByParams(params)
  if (!offer) notFound()

  const { id, ...content } = offer
  return (
    <OfferEditor
      id={id}
      offer={content}
      brand={DEFAULT_BRAND}
      templates={DEFAULT_TEMPLATES}
    />
  )
}

export default OfferPage
