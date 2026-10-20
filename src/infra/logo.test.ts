// @vitest-environment node
import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, onTestFinished, test } from 'vitest'

import { deleteLogo, getLogoFile, saveLogo } from './logo'

const setup = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'logo-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))
  return { directory: path.join(directory, 'data') }
}

const createLogo = (width: number, height: number) =>
  sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 255, alpha: 0 }
    }
  })
    .webp({ lossless: true })
    .toBuffer()

describe('saveLogo', () => {
  test('shrinks a wide logo into a PNG, keeping its proportions and transparency', async () => {
    const options = await setup()

    expect(await saveLogo(await createLogo(1800, 600), options)).toBe(
      'logo.png'
    )

    const metadata = await sharp(getLogoFile(options)).metadata()
    expect(metadata).toMatchObject({
      format: 'png',
      width: 600,
      height: 200,
      hasAlpha: true
    })
  })

  test('never enlarges a small logo', async () => {
    const options = await setup()

    await saveLogo(await createLogo(200, 100), options)

    const metadata = await sharp(getLogoFile(options)).metadata()
    expect(metadata).toMatchObject({ width: 200, height: 100 })
  })

  test('rejects a file that is not an image', async () => {
    const options = await setup()

    await expect(
      saveLogo(Buffer.from('not an image'), options)
    ).rejects.toThrow()
  })
})

describe('deleteLogo', () => {
  test('removes the logo and ignores a missing one', async () => {
    const options = await setup()
    await saveLogo(await createLogo(200, 100), options)

    await deleteLogo(options)
    await deleteLogo(options)

    await expect(access(getLogoFile(options))).rejects.toThrow()
  })
})
