import { database } from '@/infra/database/client'
import { AppError } from '@/infra/errors'
import type { PrepareBackupResponse } from '@/models/backup/backup'
import { backupModel } from '@/models/backup/model'

const respond = (body: PrepareBackupResponse, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

// A Route Handler instead of a Server Action, whose body limit (next.config.ts) a backup with the
// generations passes. It only extracts and checks the file: replacing the data takes
// applyBackupAction, which has the Server Actions' origin check
export const POST = async (request: Request) => {
  if (!request.body) {
    return respond({ status: 'error', message: 'Escolha um arquivo.' }, 400)
  }
  try {
    const preview = await backupModel.preview(
      database,
      request.body as unknown as AsyncIterable<Uint8Array>
    )
    return respond({ status: 'ready', ...preview })
  } catch (error) {
    if (error instanceof AppError) {
      return respond({ status: 'error', message: error.message }, 400)
    }
    return respond(
      {
        status: 'error',
        message: 'Não foi possível ler o backup. Tente de novo.'
      },
      500
    )
  }
}
