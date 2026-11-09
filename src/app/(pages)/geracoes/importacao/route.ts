import type { PrepareGenerationImportResponse } from '@/domain/generation-archive'
import { database } from '@/infra/database/client'
import {
  GenerationArchiveError,
  prepareGenerationImport
} from '@/infra/generation-archive'

const respond = (body: PrepareGenerationImportResponse, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

// A Route Handler instead of a Server Action, whose body limit (next.config.ts) a generation with
// many pages passes. It only extracts and checks the file: adding the generation takes
// importGenerationAction, which has the Server Actions' origin check
export const POST = async (request: Request) => {
  if (!request.body) {
    return respond({ status: 'error', message: 'Escolha um arquivo.' }, 400)
  }
  try {
    const preview = await prepareGenerationImport(
      database,
      request.body as unknown as AsyncIterable<Uint8Array>
    )
    return respond({ status: 'ready', ...preview })
  } catch (error) {
    if (error instanceof GenerationArchiveError) {
      return respond({ status: 'error', message: error.message }, 400)
    }
    return respond(
      {
        status: 'error',
        message: 'Não foi possível ler o arquivo da geração. Tente de novo.'
      },
      500
    )
  }
}
