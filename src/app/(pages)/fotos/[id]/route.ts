import { readFile } from 'node:fs/promises'

import { database } from '@/infra/database/client'
import { findPhotoFile } from '@/infra/photo'
import { productModel } from '@/models/product/model'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/fotos/[id]'>
) => {
  const { id } = await params
  const photo = productModel.findById(database, id)?.photo
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
