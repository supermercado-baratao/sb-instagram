import { access, copyFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

import {
  CATALOG_IMAGE_EXTENSION,
  isCatalogDescriptionName
} from '@/domain/catalog'
import { getPhotoFileName, isValidCode, PHOTO_MAX_SIDE } from '@/domain/product'
import { eanDirectory, noEanDirectory } from '@/infra/catalog/directory'
import { photosDirectory } from '@/infra/photos-directory'

type PhotoDirectories = {
  photos?: string
  ean?: string
  noEan?: string
}

const assertValidCode = (code: string) => {
  if (!isValidCode(code)) throw new Error(`Invalid product code: ${code}`)
}

const exists = async (file: string) => {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

export const savePhoto = async (
  code: string,
  image: Buffer,
  { photos = photosDirectory }: PhotoDirectories = {}
) => {
  assertValidCode(code)
  const photo = getPhotoFileName(code)
  await mkdir(photos, { recursive: true })
  await sharp(image)
    // Phone photos are often stored sideways with an EXIF orientation, which PNG drops
    .rotate()
    .resize({
      width: PHOTO_MAX_SIDE,
      height: PHOTO_MAX_SIDE,
      fit: 'inside',
      withoutEnlargement: true
    })
    .png()
    .toFile(path.join(photos, photo))
  return photo
}

export const listNoEanImages = async (directory = noEanDirectory) => {
  const fileNames = await readdir(directory)
  return fileNames
    .filter((fileName) => fileName.endsWith(CATALOG_IMAGE_EXTENSION))
    .map((fileName) => fileName.slice(0, -CATALOG_IMAGE_EXTENSION.length))
    .filter((name) => isCatalogDescriptionName(name))
    .toSorted((a, b) => a.localeCompare(b))
}

export const getNoEanImageFile = (name: string, directory = noEanDirectory) =>
  isCatalogDescriptionName(name)
    ? path.join(directory, `${name}${CATALOG_IMAGE_EXTENSION}`)
    : undefined

export const copyNoEanImage = async (
  name: string,
  code: string,
  { photos = photosDirectory, noEan = noEanDirectory }: PhotoDirectories = {}
) => {
  assertValidCode(code)
  const file = getNoEanImageFile(name, noEan)
  if (!file) throw new Error(`Invalid catalog image name: ${name}`)

  const photo = getPhotoFileName(code)
  await mkdir(photos, { recursive: true })
  await copyFile(file, path.join(photos, photo))
  return photo
}

// The store's own photo wins, so replacing a catalog image never needs a catalog change
export const findPhotoFile = async (
  code: string,
  { photos = photosDirectory, ean = eanDirectory }: PhotoDirectories = {}
) => {
  if (!isValidCode(code)) return

  for (const directory of [photos, ean]) {
    const file = path.join(directory, getPhotoFileName(code))
    if (await exists(file)) return file
  }
}
