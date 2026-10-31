import { getRadioListMarkdown } from '@/domain/radio-script'

import {
  findGenerationByParams,
  IMMUTABLE_CACHE_CONTROL
} from '../generation-route'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/ofertas/[id]/geracoes/[generation]/lista.md'>
) => {
  const generation = await findGenerationByParams(params)
  if (!generation?.radioScript) return new Response(null, { status: 404 })

  return new Response(getRadioListMarkdown(generation.radioScript), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="oferta-${generation.offerId}-geracao-${generation.number}-lista.md"`,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL
    }
  })
}
