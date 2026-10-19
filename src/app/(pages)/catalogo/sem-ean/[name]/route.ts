import { readFile } from 'node:fs/promises'

import { getNoEanImageFile } from '@/infra/photo'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/catalogo/sem-ean/[name]'>
) => {
  const { name } = await params
  const file = getNoEanImageFile(name)
  if (!file) return new Response(null, { status: 404 })

  try {
    return new Response(new Uint8Array(await readFile(file)), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' }
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}
