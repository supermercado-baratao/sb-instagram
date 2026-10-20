import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Poster } from '@/app/components/blocks/poster'
import { getPosterOffer, getPosterProducts } from '@/app/helpers/offer-poster'
import { getPageTemplate } from '@/domain/poster'
import { DEFAULT_BRAND, DEFAULT_TEMPLATES } from '@/domain/poster-defaults'
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
  const offer = findOffer(database, Number(id))
  const page = offer?.pages[Number(pageNumber) - 1]
  const template = page && getPageTemplate(DEFAULT_TEMPLATES, page.templateId)
  if (!offer || !page || !template) notFound()

  return (
    <Poster
      brand={DEFAULT_BRAND}
      offer={getPosterOffer(offer)}
      template={template}
      layout={page.layout}
      products={getPosterProducts(page.slots)}
    />
  )
}

export default OfferPageRender
