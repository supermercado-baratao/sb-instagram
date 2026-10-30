import { GENERATION_PDF_FILE_NAME } from '@/domain/offer-generation'
import { readGenerationFile } from '@/infra/offer-generation'

import {
  findGenerationByParams,
  IMMUTABLE_CACHE_CONTROL
} from '../generation-route'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/ofertas/[id]/geracoes/[generation]/paginas.pdf'>
) => {
  const generation = await findGenerationByParams(params)
  const pdf = generation
    ? await readGenerationFile(generation.id, GENERATION_PDF_FILE_NAME)
    : undefined
  if (!generation || !pdf) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      // Inline, so the browser opens its PDF viewer, which prints it
      'Content-Disposition': `inline; filename="oferta-${generation.offerId}-geracao-${generation.number}.pdf"`,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL
    }
  })
}
