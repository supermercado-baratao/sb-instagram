import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { CATALOG_IMAGE_EXTENSION } from '@/domain/catalog'
import { eanDirectory, noEanDirectory } from '@/infra/catalog/directory'
import { prepareCatalogImage } from '@/infra/catalog/optimize'

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
    const { image, errors } = await prepareCatalogImage(original)

    if (image && image !== original) {
      await writeFile(file, image)
      console.log(
        `${name}: ${formatBytes(original.length)} → ${formatBytes(image.length)}`
      )
    }

    for (const message of errors) {
      console.error(`${name}: ${message}`)
      failed = true
    }
  } catch {
    console.error(`${name}: O arquivo não é uma imagem válida`)
    failed = true
  }
}

if (failed) process.exitCode = 1
