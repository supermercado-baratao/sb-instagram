import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Poster } from '@/app/components/blocks/poster'
import { getPosterBrand } from '@/app/helpers/brand-poster'
import { getPosterOffer, getPosterProducts } from '@/app/helpers/offer-poster'
import { getPageTemplate } from '@/domain/poster'
import { findBrandSettings } from '@/infra/brand'
import { database } from '@/infra/database/client'
import { findOffer } from '@/infra/offer'

export const metadata: Metadata = {
  title: 'Pôster',
  robots: { index: false }
}

// Captured by the PNG route at the poster's real size, so it has no zoom or controls around it
const OfferPageRender = async ({
  params
}: PageProps<'/ofertas/[id]/render/[page]'>) => {
  const { id, page: pageNumber } = await params
  const settings = findBrandSettings(database)
  const offer = findOffer(database, Number(id))
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
