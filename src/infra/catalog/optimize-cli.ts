import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  CATALOG_IMAGE_EXTENSION,
  checkCatalogImage,
  hasTransparentBackground,
  TRANSPARENT_BACKGROUND_ERROR
} from '@/domain/catalog'
import { eanDirectory, noEanDirectory } from '@/infra/catalog/directory'
import { readCatalogImage } from '@/infra/catalog/image'
import { optimizeCatalogImage } from '@/infra/catalog/optimize'

const listImages = async (directory: string) => {
  const fileNames = await readdir(directory)
  return fileNames
    .filter((fileName) => fileName.endsWith(CATALOG_IMAGE_EXTENSION))
    .map((fileName) => path.join(directory, fileName))
}

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`

// lint-staged passes the staged images; without arguments the whole catalog is optimized
const files =
  process.argv.length > 2
    ? process.argv.slice(2)
    : [
        ...(await listImages(eanDirectory)),
        ...(await listImages(noEanDirectory))
      ]

let failed = false

for (const file of files) {
  const name = path.relative(process.cwd(), file)
  const original = await readFile(file)

  try {
    const originalImage = await readCatalogImage(original)
    if (checkCatalogImage(originalImage).length === 0) continue

    // The margin added around the product makes the corners transparent, so a photo with a
    // background would pass the check once framed: it has to be rejected before that
    if (!hasTransparentBackground(originalImage)) {
      console.error(`${name}: ${TRANSPARENT_BACKGROUND_ERROR}`)
      failed = true
      continue
    }

    const optimized = await optimizeCatalogImage(original)
    await writeFile(file, optimized)
    console.log(
      `${name}: ${formatBytes(original.length)} → ${formatBytes(optimized.length)}`
    )

    const remainingErrors = checkCatalogImage(await readCatalogImage(optimized))
    for (const message of remainingErrors) {
      console.error(`${name}: ${message}`)
      failed = true
    }
  } catch {
    console.error(`${name}: O arquivo não é uma imagem válida`)
    failed = true
  }
}

if (failed) process.exitCode = 1
