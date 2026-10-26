import { zipSync } from 'fflate'

import { buildCatalogExport } from '@/infra/catalog/export'
import { database } from '@/infra/database/client'

export const GET = async () => {
  // PNG is already compressed, so the files are only stored
  const zip = zipSync(await buildCatalogExport(database), { level: 0 })

  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="catalogo.zip"',
      'Cache-Control': 'no-store'
    }
  })
}
