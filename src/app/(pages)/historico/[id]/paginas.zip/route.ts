import {
  findGenerationByParams,
  IMMUTABLE_CACHE_CONTROL
} from '@/app/(pages)/historico/[id]/generation-route'
import { generationModel } from '@/models/generation/model'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/historico/[id]/paginas.zip'>
) => {
  const generation = await findGenerationByParams(params)
  if (!generation) return new Response(null, { status: 404 })

  const zip = await generationModel.createPagesArchive(generation)
  if (!zip) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="oferta-${generation.number}-artes.zip"`,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL
    }
  })
}
