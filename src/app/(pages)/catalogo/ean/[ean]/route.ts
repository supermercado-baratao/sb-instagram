import { readFile } from 'node:fs/promises'

import { getEanImageFile } from '@/infra/photo'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/catalogo/ean/[ean]'>
) => {
  const { ean } = await params
  const file = getEanImageFile(ean)
  if (!file) return new Response(null, { status: 404 })

  try {
    return new Response(new Uint8Array(await readFile(file)), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' }
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}
