import { readFile } from 'node:fs/promises'

import { findPhotoFile } from '@/infra/photo'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/fotos/[code]'>
) => {
  const { code } = await params
  const file = await findPhotoFile(code)
  if (!file) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(await readFile(file)), {
    headers: {
      'Content-Type': 'image/png',
      // A new upload keeps the same URL, so the browser must check before reusing its copy
      'Cache-Control': 'no-cache'
    }
  })
}
