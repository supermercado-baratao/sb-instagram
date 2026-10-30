import { zipSync } from 'fflate'

import { getGenerationPageFileName } from '@/domain/offer-generation'
import { readGenerationFile } from '@/infra/offer-generation'

import {
  findGenerationByParams,
  IMMUTABLE_CACHE_CONTROL
} from '../generation-route'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/ofertas/[id]/geracoes/[generation]/paginas.zip'>
) => {
  const generation = await findGenerationByParams(params)
  if (!generation) return new Response(null, { status: 404 })

  const files: Record<string, Uint8Array> = {}
  for (let pageNumber = 1; pageNumber <= generation.pageCount; pageNumber++) {
    const fileName = getGenerationPageFileName(pageNumber)
    const png = await readGenerationFile(generation.id, fileName)
    if (!png) return new Response(null, { status: 404 })
    files[fileName] = png
  }

  // PNG is already compressed, so the files are only stored
  const zip = zipSync(files, { level: 0 })

  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="oferta-${generation.offerId}-geracao-${generation.number}.zip"`,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL
    }
  })
}
