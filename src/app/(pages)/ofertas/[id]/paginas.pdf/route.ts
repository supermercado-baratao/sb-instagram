import { database } from '@/infra/database/client'
import { findOffer } from '@/infra/offer'
import { renderPosterPdf } from '@/infra/poster-renderer'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/ofertas/[id]/paginas.pdf'>
) => {
  const { id } = await params
  const offer = findOffer(database, Number(id))
  if (!offer) return new Response(null, { status: 404 })

  const pdf = await renderPosterPdf(`/ofertas/${offer.id}/impressao`)

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      // Inline, so the browser opens its PDF viewer, which prints it
      'Content-Disposition': `inline; filename="oferta-${offer.id}.pdf"`,
      'Cache-Control': 'no-store'
    }
  })
}
