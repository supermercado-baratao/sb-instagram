import { getGenerationArchiveName } from '@/domain/generation-archive'
import { database } from '@/infra/database/client'
import { createGenerationArchive } from '@/infra/generation-archive'

import {
  findGenerationByParams,
  IMMUTABLE_CACHE_CONTROL
} from '../generation-route'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/historico/[id]/geracao.zip'>
) => {
  const generation = await findGenerationByParams(params)
  const result =
    generation && (await createGenerationArchive(database, generation.id))
  if (!result) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(result.archive), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${getGenerationArchiveName(result.generation.number)}"`,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL
    }
  })
}
