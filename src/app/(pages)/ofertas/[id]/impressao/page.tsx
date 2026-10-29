import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Poster } from '@/app/components/blocks/poster'
import { getPosterBrand } from '@/app/helpers/brand-poster'
import { getPosterOffer, getPosterProducts } from '@/app/helpers/offer-poster'
import { getPageTemplate, getPosterFitScale } from '@/domain/poster'
import { findBrandSettings } from '@/infra/brand'
import { database } from '@/infra/database/client'
import { findOffer } from '@/infra/offer'

export const metadata: Metadata = {
  title: 'Impressão',
  robots: { index: false }
}

const SHEET_MARGIN_MM = 10
const PRINT_AREA_MM = {
  width: 210 - 2 * SHEET_MARGIN_MM,
  height: 297 - 2 * SHEET_MARGIN_MM
}
const PX_PER_MM = 96 / 25.4

const printScale = getPosterFitScale({
  width: PRINT_AREA_MM.width * PX_PER_MM,
  height: PRINT_AREA_MM.height * PX_PER_MM
})

// Printed to PDF by the renderer, one saved page per A4 sheet, so it has no header or controls
const OfferPrint = async ({ params }: PageProps<'/ofertas/[id]/impressao'>) => {
  const { id } = await params
  const settings = findBrandSettings(database)
  const offer = findOffer(database, Number(id))
  if (!settings || !offer) notFound()

  const brand = getPosterBrand(settings.brand)
  const posterOffer = getPosterOffer(offer)

  return (
    // A wrapper, so the root layout's Toaster after it doesn't make the last sheet break onto a blank one
    <div>
      <style>{`@page { size: A4; margin: ${SHEET_MARGIN_MM}mm; }`}</style>
      {offer.pages.map((page, index) => {
        const template = getPageTemplate(settings.templates, page.templateId)
        if (!template) return null
        return (
          <section
            key={index}
            // 1mm short of the print area, so rounding never spills a sheet onto a blank one
            style={{ height: `${PRINT_AREA_MM.height - 1}mm` }}
            className="flex items-center justify-center not-last:break-after-page"
          >
            <div style={{ zoom: printScale }}>
              <Poster
                brand={brand}
                offer={posterOffer}
                template={template}
                layout={page.layout}
                products={getPosterProducts(page.slots)}
              />
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default OfferPrint
