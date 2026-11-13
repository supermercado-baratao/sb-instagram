import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'

import { Poster } from '@/app/components/blocks/poster'
import { getPosterBrand } from '@/app/helpers/brand-poster'
import { getPosterOffer, getPosterProducts } from '@/app/helpers/offer-poster'
import { database } from '@/infra/database/client'
import { brandModel } from '@/models/brand/model'
import { offerModel } from '@/models/offer/model'
import { getPageTemplate } from '@/models/poster/poster'

export const metadata: Metadata = {
  title: 'Pôster',
  robots: { index: false }
}

// Captured by the PNG route at the poster's real size, so it has no zoom or controls around it
const OfferPageRender = async ({
  params
}: PageProps<'/ofertas/render/[page]'>) => {
  await connection()
  const { page: pageNumber } = await params
  const settings = brandModel.findSettings(database)
  const offer = offerModel.findCurrent(database)
  const page = offer?.pages[Number(pageNumber) - 1]
  const template =
    settings && page && getPageTemplate(settings.templates, page.templateId)
  if (!settings || !offer || !page || !template) notFound()

  return (
    <Poster
      brand={getPosterBrand(settings.brand)}
      offer={getPosterOffer(offer)}
      template={template}
      layout={page.layout}
      products={getPosterProducts(page.slots)}
    />
  )
}

export default OfferPageRender
