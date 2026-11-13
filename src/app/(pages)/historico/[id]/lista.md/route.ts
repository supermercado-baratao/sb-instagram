import {
  findGenerationByParams,
  IMMUTABLE_CACHE_CONTROL
} from '@/app/(pages)/historico/[id]/generation-route'
import { getRadioListMarkdown } from '@/models/radio-ad/radio-script'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/historico/[id]/lista.md'>
) => {
  const generation = await findGenerationByParams(params)
  if (!generation?.radioScript) return new Response(null, { status: 404 })

  return new Response(getRadioListMarkdown(generation.radioScript), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="oferta-${generation.number}-lista.md"`,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL
    }
  })
}
