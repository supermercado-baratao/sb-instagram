import { readFile } from 'node:fs/promises'

import { isValidProductId } from '@/domain/product'
import { database } from '@/infra/database/client'
import { findPhotoFile } from '@/infra/photo'
import { findProductById } from '@/infra/product'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/fotos/[id]'>
) => {
  const { id } = await params
  const photo = isValidProductId(id) && findProductById(database, id)?.photo
  const file = photo ? await findPhotoFile(photo) : undefined
  if (!file) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(await readFile(file)), {
    headers: {
      'Content-Type': 'image/png',
      // A new upload keeps the same URL, so the browser must check before reusing its copy
      'Cache-Control': 'no-cache'
    }
  })
}
