import {
  findGenerationByParams,
  IMMUTABLE_CACHE_CONTROL
} from '@/app/(pages)/historico/[id]/generation-route'
import { database } from '@/infra/database/client'
import { getGenerationArchiveName } from '@/models/generation-archive/archive'
import { generationArchiveModel } from '@/models/generation-archive/model'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/historico/[id]/geracao.zip'>
) => {
  const generation = await findGenerationByParams(params)
  const result =
    generation && (await generationArchiveModel.create(database, generation.id))
  if (!result) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(result.archive), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${getGenerationArchiveName(result.generation.number)}"`,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL
    }
  })
}
