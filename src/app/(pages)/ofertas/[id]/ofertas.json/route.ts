import { getOfferExport } from '@/domain/offer-export'
import { database } from '@/infra/database/client'
import { findOffer } from '@/infra/offer'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/ofertas/[id]/ofertas.json'>
) => {
  const { id } = await params
  const offer = findOffer(database, Number(id))
  if (!offer) return new Response(null, { status: 404 })

  // Indented, since the store opens the file to read or edit it by hand
  return new Response(JSON.stringify(getOfferExport(offer), null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="oferta-${offer.id}-produtos.json"`,
      'Cache-Control': 'no-store'
    }
  })
}
