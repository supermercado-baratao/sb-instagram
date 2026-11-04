import { database } from '@/infra/database/client'
import { findGenerationExport } from '@/infra/generation'

import {
  findGenerationByParams,
  IMMUTABLE_CACHE_CONTROL
} from '../generation-route'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/geracoes/[id]/ofertas.json'>
) => {
  const generation = await findGenerationByParams(params)
  const offerExport =
    generation && findGenerationExport(database, generation.id)
  if (!generation || !offerExport) return new Response(null, { status: 404 })

  return new Response(offerExport, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="geracao-${generation.number}-produtos.json"`,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL
    }
  })
}
