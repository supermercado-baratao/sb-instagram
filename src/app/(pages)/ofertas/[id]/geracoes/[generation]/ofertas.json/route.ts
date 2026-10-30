import { database } from '@/infra/database/client'
import { findOfferGenerationExport } from '@/infra/offer-generation'

import {
  findGenerationByParams,
  IMMUTABLE_CACHE_CONTROL
} from '../generation-route'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/ofertas/[id]/geracoes/[generation]/ofertas.json'>
) => {
  const generation = await findGenerationByParams(params)
  const offerExport =
    generation &&
    findOfferGenerationExport(database, generation.offerId, generation.id)
  if (!generation || !offerExport) return new Response(null, { status: 404 })

  return new Response(offerExport, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="oferta-${generation.offerId}-geracao-${generation.number}-produtos.json"`,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL
    }
  })
}
