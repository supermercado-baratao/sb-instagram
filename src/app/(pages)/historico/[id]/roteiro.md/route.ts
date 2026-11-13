import { getRadioScriptMarkdown } from '@/models/radio-ad/radio-script'

import {
  findGenerationByParams,
  IMMUTABLE_CACHE_CONTROL
} from '../generation-route'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/historico/[id]/roteiro.md'>
) => {
  const generation = await findGenerationByParams(params)
  if (!generation?.radioScript) return new Response(null, { status: 404 })

  return new Response(getRadioScriptMarkdown(generation.radioScript), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="oferta-${generation.number}-roteiro.md"`,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL
    }
  })
}
