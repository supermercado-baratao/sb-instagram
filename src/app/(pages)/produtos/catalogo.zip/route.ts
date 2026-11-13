import { zipSync } from 'fflate'
import type { NextRequest } from 'next/server'

import { database } from '@/infra/database/client'
import { catalogExportModel } from '@/models/catalog-export/model'

// POST, since each export records what it took, so the next one takes only what changed (#66)
export const POST = async (request: NextRequest) => {
  // A Route Handler has no origin check, unlike a Server Action, and a cross-site request would
  // mark products as exported, leaving them out of the next ZIP
  const site = request.headers.get('Sec-Fetch-Site')
  if (site !== null && site !== 'same-origin') {
    return new Response(null, { status: 403 })
  }

  const all = request.nextUrl.searchParams.get('todos') === '1'
  const { files, exportedCount } = await catalogExportModel.build(database, {
    all
  })
  if (exportedCount === 0) return new Response(null, { status: 204 })

  // PNG is already compressed, so the files are only stored
  const zip = zipSync(files, { level: 0 })

  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="catalogo.zip"',
      'Cache-Control': 'no-store',
      'X-Exported-Count': String(exportedCount)
    }
  })
}
