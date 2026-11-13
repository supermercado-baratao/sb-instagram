import { Readable } from 'node:stream'

import { database } from '@/infra/database/client'
import { getBackupDownloadName } from '@/models/backup/backup'
import { backupModel } from '@/models/backup/model'
import { backupDateSchema } from '@/models/backup/schema'

export const GET = (request: Request) => {
  // The date comes from the browser, since the container's clock usually runs in UTC
  const date = backupDateSchema.safeParse(
    new URL(request.url).searchParams.get('data')
  )
  const name = getBackupDownloadName(
    date.success ? date.data : new Date().toISOString().slice(0, 10)
  )
  const body = Readable.toWeb(
    Readable.from(backupModel.createArchive(database))
  ) as ReadableStream<Uint8Array>

  return new Response(body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store'
    }
  })
}
