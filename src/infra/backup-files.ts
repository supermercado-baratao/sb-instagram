import { mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'

import { Zip, ZipDeflate } from 'fflate'

import { dataDirectory as defaultDataDirectory } from './data-directory'

const EXPORT_PREFIX = '.backup-'
const RESTORE_PREFIX = '.restore-'

// The token is checked by the caller, since it may come from a request
export const getRestoreFolder = (dataDirectory: string, token: string) =>
  path.join(dataDirectory, `${RESTORE_PREFIX}${token}`)

export const getExportFolder = (dataDirectory: string, token: string) =>
  path.join(dataDirectory, `${EXPORT_PREFIX}${token}`)

export const createFolder = (folder: string) =>
  mkdir(folder, { recursive: true })

export const removeFolder = (folder: string) =>
  rm(folder, { recursive: true, force: true })

export const removeFile = (file: string) => rm(file)

export const readDataFile = (file: string) => readFile(file)

export const readTextFile = (file: string) => readFile(file, 'utf8')

export const fileExists = async (file: string) => {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

// Temporary names start with a dot, like the generations' own, so neither a backup nor a restore
// takes them
const listFiles = async (folder: string, prefix = ''): Promise<string[]> => {
  const entries = await readdir(folder, { withFileTypes: true })
  const files = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.'))
      .map(async (entry) => {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          return listFiles(path.join(folder, entry.name), relative)
        }
        return entry.isFile() ? [relative] : []
      })
  )
  return files.flat().toSorted((a, b) => a.localeCompare(b))
}

// Every file under the given entries of the data directory, as paths relative to it
export const listDataFiles = async (
  dataDirectory: string,
  entries: readonly string[]
) => {
  const files: string[] = []
  for (const entry of entries) {
    const entryPath = path.join(dataDirectory, entry)
    let entryStat
    try {
      entryStat = await stat(entryPath)
    } catch {
      continue
    }
    if (entryStat.isFile()) files.push(entry)
    else if (entryStat.isDirectory()) {
      files.push(...(await listFiles(entryPath, entry)))
    }
  }
  return files
}

export const moveEntries = async (
  from: string,
  to: string,
  entries: readonly string[]
) => {
  const moved: string[] = []
  for (const entry of entries) {
    if (!(await fileExists(path.join(from, entry)))) continue
    await mkdir(to, { recursive: true })
    await rename(path.join(from, entry), path.join(to, entry))
    moved.push(entry)
  }
  return moved
}

// Collects the chunks a ZIP produces, so a caller yields them as each file is added. Deflate frames
// every entry, so a streaming reader finds where each one ends without the central directory
export const createZipWriter = () => {
  const chunks: Uint8Array[] = []
  let failure: Error | undefined
  const zip = new Zip((error, chunk) => {
    if (error) failure = error
    else chunks.push(chunk)
  })
  return {
    add: (name: string, data: Uint8Array, level: 0 | 6) => {
      const file = new ZipDeflate(name, { level })
      zip.add(file)
      file.push(data, true)
      if (failure) throw failure
    },
    end: () => {
      zip.end()
      if (failure) throw failure
    },
    flush: () => chunks.splice(0)
  }
}

// A restart interrupts a download being built or a backup the store never confirmed
export const removeTemporaryBackupFolders = async (
  dataDirectory = defaultDataDirectory
) => {
  let entries: string[]
  try {
    entries = await readdir(dataDirectory)
  } catch {
    return
  }
  await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.startsWith(EXPORT_PREFIX) || entry.startsWith(RESTORE_PREFIX)
      )
      .map((entry) => removeFolder(path.join(dataDirectory, entry)))
  )
}
