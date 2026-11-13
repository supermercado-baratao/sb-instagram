import {
  findGenerationByParams,
  IMMUTABLE_CACHE_CONTROL
} from '@/app/(pages)/historico/[id]/generation-route'
import { database } from '@/infra/database/client'
import { generationModel } from '@/models/generation/model'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/historico/[id]/ofertas.json'>
) => {
  const generation = await findGenerationByParams(params)
  const offerExport =
    generation && generationModel.findExport(database, generation.id)
  if (!generation || !offerExport) return new Response(null, { status: 404 })

  return new Response(offerExport, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="oferta-${generation.number}-dados.json"`,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL
    }
  })
}
