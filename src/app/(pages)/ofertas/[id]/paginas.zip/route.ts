import { zipSync } from 'fflate'

import { database } from '@/infra/database/client'
import { findOffer } from '@/infra/offer'
import { renderPosterPng } from '@/infra/poster-renderer'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/ofertas/[id]/paginas.zip'>
) => {
  const { id } = await params
  const offer = findOffer(database, Number(id))
  if (!offer) return new Response(null, { status: 404 })

  const files: Record<string, Uint8Array> = {}
  // One page at a time, so a long offer doesn't open a Chromium tab per page at once
  for (const index of offer.pages.keys()) {
    const number = index + 1
    files[`pagina-${number}.png`] = await renderPosterPng(
      `/ofertas/${offer.id}/render/${number}`
    )
  }

  // PNG is already compressed, so the files are only stored
  const zip = zipSync(files, { level: 0 })

  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="oferta-${offer.id}.zip"`,
      'Cache-Control': 'no-store'
    }
  })
}
