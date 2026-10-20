import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

import { LOGO_FILE_NAME, LOGO_MAX_SIDE } from '@/domain/brand'
import { dataDirectory } from '@/infra/data-directory'

type LogoOptions = { directory?: string }

export const getLogoFile = ({ directory = dataDirectory }: LogoOptions = {}) =>
  path.join(directory, LOGO_FILE_NAME)

// Keeps the logo's own proportions and transparency, since the poster fits it in a box
export const saveLogo = async (image: Buffer, options: LogoOptions = {}) => {
  const file = getLogoFile(options)
  await mkdir(path.dirname(file), { recursive: true })
  await sharp(image)
    .rotate()
    .resize({
      width: LOGO_MAX_SIDE,
      height: LOGO_MAX_SIDE,
      fit: 'inside',
      withoutEnlargement: true
    })
    .png()
    .toFile(file)
  return LOGO_FILE_NAME
}

export const deleteLogo = (options: LogoOptions = {}) =>
  rm(getLogoFile(options), { force: true })
