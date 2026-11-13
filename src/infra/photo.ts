import { copyFile, mkdir, readFile, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

import { CATALOG_IMAGE_EXTENSION } from '@/constants/catalog'
import { PHOTO_MAX_SIDE } from '@/constants/photo'

import { photosDirectory } from './photos-directory'

type PhotoDirectories = {
  photos?: string
}

// File names come from getPhotoFileName, built from a checked code or id, but a name read back
// from the database must still never reach a file outside the photos folder
const isPhotoFileName = (fileName: string) =>
  path.basename(fileName) === fileName &&
  fileName.endsWith(CATALOG_IMAGE_EXTENSION)

const getPhotoPath = (photos: string, fileName: string) => {
  if (!isPhotoFileName(fileName)) {
    throw new Error(`Invalid photo file name: ${fileName}`)
  }
  return path.join(photos, fileName)
}

export const savePhoto = async (
  fileName: string,
  image: Buffer,
  { photos = photosDirectory }: PhotoDirectories = {}
) => {
  const file = getPhotoPath(photos, fileName)
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
    .toFile(file)
}

// The photo is copied rather than referenced, so a later catalog update never changes a product
// the store already uses
export const copyIntoPhotos = async (
  source: string,
  fileName: string,
  { photos = photosDirectory }: PhotoDirectories = {}
) => {
  const target = getPhotoPath(photos, fileName)
  await mkdir(photos, { recursive: true })
  await copyFile(source, target)
}

export const renamePhoto = async (
  from: string,
  to: string,
  { photos = photosDirectory }: PhotoDirectories = {}
) => {
  await rename(getPhotoPath(photos, from), getPhotoPath(photos, to))
}

export const removePhoto = async (
  fileName: string,
  { photos = photosDirectory }: PhotoDirectories = {}
) => {
  await rm(getPhotoPath(photos, fileName), { force: true })
}

export const readPhoto = async (
  fileName: string,
  { photos = photosDirectory }: PhotoDirectories = {}
) => {
  try {
    return await readFile(getPhotoPath(photos, fileName))
  } catch {
    return
  }
}

// Changes with every write, so a cache keyed by it reads a new upload under the same name again
export const getPhotoVersion = async (
  fileName: string,
  { photos = photosDirectory }: PhotoDirectories = {}
) => {
  try {
    const { size, mtimeMs } = await stat(getPhotoPath(photos, fileName))
    return `${size}:${mtimeMs}`
  } catch {
    return
  }
}
