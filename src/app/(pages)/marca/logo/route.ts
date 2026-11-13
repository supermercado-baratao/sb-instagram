import { database } from '@/infra/database/client'
import { brandModel } from '@/models/brand/model'

export const GET = async () => {
  const logo = await brandModel.readLogo(database)
  if (!logo) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(logo), {
    headers: {
      'Content-Type': 'image/png',
      // A new upload keeps the same URL, so the browser must check before reusing its copy
      'Cache-Control': 'no-cache'
    }
  })
}
