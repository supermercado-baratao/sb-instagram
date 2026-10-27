import { access, copyFile, mkdir, readdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

import {
  CATALOG_IMAGE_EXTENSION,
  isCatalogDescriptionName
} from '@/domain/catalog'
import { isValidEan } from '@/domain/ean'
import { PHOTO_MAX_SIDE } from '@/domain/product'
import { eanDirectory, noEanDirectory } from '@/infra/catalog/directory'
import { getCatalogImageFile } from '@/infra/catalog/product'
import { photosDirectory } from '@/infra/photos-directory'

type PhotoDirectories = {
  photos?: string
  ean?: string
  noEan?: string
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

const exists = async (file: string) => {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
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
  fileName: string,
  { photos = photosDirectory, noEan = noEanDirectory }: PhotoDirectories = {}
) => {
  const file = getNoEanImageFile(name, noEan)
  if (!file) throw new Error(`Invalid catalog image name: ${name}`)

  const target = getPhotoPath(photos, fileName)
  await mkdir(photos, { recursive: true })
  await copyFile(file, target)
}

export const getEanImageFile = (ean: string, directory = eanDirectory) =>
  isValidEan(ean) ? getCatalogImageFile(ean, directory) : undefined

// The photo is copied rather than referenced, so a later catalog update never changes a product
// the store already uses
export const copyEanImage = async (
  ean: string,
  fileName: string,
  {
    photos = photosDirectory,
    ean: eanFolder = eanDirectory
  }: PhotoDirectories = {}
) => {
  const file = getEanImageFile(ean, eanFolder)
  if (!file || !(await exists(file))) return false

  const target = getPhotoPath(photos, fileName)
  await mkdir(photos, { recursive: true })
  await copyFile(file, target)
  return true
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

export const findPhotoFile = async (
  fileName: string,
  { photos = photosDirectory }: PhotoDirectories = {}
) => {
  if (!isPhotoFileName(fileName)) return
  const file = path.join(photos, fileName)
  return (await exists(file)) ? file : undefined
}
