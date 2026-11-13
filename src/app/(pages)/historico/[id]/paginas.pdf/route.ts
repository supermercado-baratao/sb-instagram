import {
  findGenerationByParams,
  IMMUTABLE_CACHE_CONTROL
} from '@/app/(pages)/historico/[id]/generation-route'
import { generationModel } from '@/models/generation/model'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/historico/[id]/paginas.pdf'>
) => {
  const generation = await findGenerationByParams(params)
  const pdf = generation && (await generationModel.readPdf(generation))
  if (!generation || !pdf) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      // Inline, so the browser opens its PDF viewer, which prints it
      'Content-Disposition': `inline; filename="oferta-${generation.number}.pdf"`,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL
    }
  })
}
