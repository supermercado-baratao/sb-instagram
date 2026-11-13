import {
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import path from 'node:path'

import { dataDirectory } from './data-directory'

export const generationsDirectory = path.join(dataDirectory, 'generations')

const TEMPORARY_PREFIX = '.tmp-'

export const getGenerationFolder = (
  generationId: number,
  directory = generationsDirectory
) => path.join(directory, String(generationId))

// The token is checked by the caller, since it may come from a request
export const getTemporaryGenerationFolder = (
  token: string,
  directory = generationsDirectory
) => path.join(directory, `${TEMPORARY_PREFIX}${token}`)

// File names come from the generation's own constants, never from the request
const getFile = (folder: string, fileName: string) => {
  if (path.basename(fileName) !== fileName) {
    throw new Error(`Invalid generation file name: ${fileName}`)
  }
  return path.join(folder, fileName)
}

export const createFolder = (folder: string) =>
  mkdir(folder, { recursive: true })

export const writeFolderFile = (
  folder: string,
  fileName: string,
  data: Uint8Array
) => writeFile(getFile(folder, fileName), data)

export const readFolderFile = (folder: string, fileName: string) =>
  readFile(getFile(folder, fileName))

export const readFolderText = (folder: string, fileName: string) =>
  readFile(getFile(folder, fileName), 'utf8')

export const removeFolderFile = (folder: string, fileName: string) =>
  rm(getFile(folder, fileName))

export const hasFolderFile = async (folder: string, fileName: string) => {
  try {
    await stat(getFile(folder, fileName))
    return true
  } catch {
    return false
  }
}

// Reads only the first bytes, so a large file is never loaded to check what it is
export const hasFileSignature = async (
  folder: string,
  fileName: string,
  signature: Buffer
) => {
  const handle = await open(getFile(folder, fileName))
  try {
    const head = Buffer.alloc(signature.length)
    const { bytesRead } = await handle.read(head, 0, signature.length, 0)
    return bytesRead === signature.length && head.equals(signature)
  } finally {
    await handle.close()
  }
}

export const removeFolder = (folder: string) =>
  rm(folder, { recursive: true, force: true })

export const moveToGenerationFolder = (
  folder: string,
  generationId: number,
  directory = generationsDirectory
) => rename(folder, getGenerationFolder(generationId, directory))

export const readGenerationFile = async (
  generationId: number,
  fileName: string,
  directory = generationsDirectory
) => {
  try {
    return await readFolderFile(
      getGenerationFolder(generationId, directory),
      fileName
    )
  } catch {
    return
  }
}

// A generation interrupted by a restart leaves its temporary folder behind
export const removeTemporaryGenerationFolders = async (
  directory = generationsDirectory
) => {
  let entries: string[]
  try {
    entries = await readdir(directory)
  } catch {
    return
  }
  await Promise.all(
    entries
      .filter((entry) => entry.startsWith(TEMPORARY_PREFIX))
      .map((entry) => removeFolder(path.join(directory, entry)))
  )
}
