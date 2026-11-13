import {
  findGenerationByParams,
  IMMUTABLE_CACHE_CONTROL
} from '@/app/(pages)/historico/[id]/generation-route'
import { generationModel } from '@/models/generation/model'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/historico/[id]/pagina/[page]'>
) => {
  const generation = await findGenerationByParams(params)
  const { page } = await params
  const pageNumber = Number(page)
  const png =
    generation && (await generationModel.readPage(generation, pageNumber))
  if (!png) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': IMMUTABLE_CACHE_CONTROL
    }
  })
}
