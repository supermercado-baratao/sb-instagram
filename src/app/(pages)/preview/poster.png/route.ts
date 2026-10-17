import type { NextRequest } from 'next/server'

import { renderPosterPng } from '@/infra/poster-renderer'

export const GET = async (request: NextRequest) => {
  const parameters = new URLSearchParams()
  for (const name of ['layout', 'template']) {
    const value = request.nextUrl.searchParams.get(name)
    if (value) parameters.set(name, value)
  }

  const png = await renderPosterPng(`/preview/render?${parameters}`)

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': 'attachment; filename="oferta.png"',
      'Cache-Control': 'no-store'
    }
  })
}
