import { readFile } from 'node:fs/promises'

import { findBrandSettings } from '@/infra/brand'
import { database } from '@/infra/database/client'
import { getLogoFile } from '@/infra/logo'

export const GET = async () => {
  if (!findBrandSettings(database)?.brand.logo) {
    return new Response(null, { status: 404 })
  }

  const logo = await readFile(getLogoFile())
  return new Response(new Uint8Array(logo), {
    headers: {
      'Content-Type': 'image/png',
      // A new upload keeps the same URL, so the browser must check before reusing its copy
      'Cache-Control': 'no-cache'
    }
  })
}
