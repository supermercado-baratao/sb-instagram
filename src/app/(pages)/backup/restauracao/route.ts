import { getBackupChanges, type PrepareBackupResponse } from '@/domain/backup'
import { BackupError, prepareBackup, summarizeDatabase } from '@/infra/backup'
import { database } from '@/infra/database/client'

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
    const { token, manifest, summary } = await prepareBackup(
      request.body as unknown as AsyncIterable<Uint8Array>
    )
    return respond({
      status: 'ready',
      token,
      createdAt: manifest.createdAt,
      changes: getBackupChanges(summarizeDatabase(database), summary)
    })
  } catch (error) {
    if (error instanceof BackupError) {
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
