import { expect, test } from '@playwright/test'

import { POSTER_SIZE } from '@/domain/poster'

test('downloads the poster as a PNG at its real size', async ({ request }) => {
  const response = await request.get('/preview/poster.png?layout=4')

  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toBe('image/png')
  const png = await response.body()
  // The IHDR chunk holds the width and height right after the 8-byte signature and its header
  expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }).toEqual(
    POSTER_SIZE
  )
})
