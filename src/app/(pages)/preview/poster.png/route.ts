import type { NextRequest } from 'next/server'

import { posterModel } from '@/models/poster/model'

export const GET = async (request: NextRequest) => {
  const png = await posterModel.renderPreview(request.nextUrl.searchParams)

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': 'attachment; filename="oferta.png"',
      'Cache-Control': 'no-store'
    }
  })
}
