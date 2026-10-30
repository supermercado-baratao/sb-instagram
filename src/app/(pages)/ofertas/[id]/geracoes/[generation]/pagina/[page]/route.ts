import {
  getGenerationPageFileName,
  isGenerationPageNumber
} from '@/domain/offer-generation'
import { readGenerationFile } from '@/infra/offer-generation'

import {
  findGenerationByParams,
  IMMUTABLE_CACHE_CONTROL
} from '../../generation-route'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/ofertas/[id]/geracoes/[generation]/pagina/[page]'>
) => {
  const generation = await findGenerationByParams(params)
  const { page } = await params
  const pageNumber = Number(page)
  const png =
    generation && isGenerationPageNumber(generation, pageNumber)
      ? await readGenerationFile(
          generation.id,
          getGenerationPageFileName(pageNumber)
        )
      : undefined
  if (!png) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': IMMUTABLE_CACHE_CONTROL
    }
  })
}
