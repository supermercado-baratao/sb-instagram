import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { finished } from 'node:stream/promises'

import { Unzip, UnzipInflate } from 'fflate'

export class InvalidZipError extends Error {}

// Segments of the entry's path inside the folder, null to skip the entry, or undefined to refuse
// the whole archive
export type ZipEntryTarget = (name: string) => string[] | null | undefined

// Each entry streams to its file, so an archive with years of generations never sits in memory.
// The names come from an uploaded file, so getTarget must only return plain relative segments
export const extractZip = async (
  archive: AsyncIterable<Uint8Array>,
  folder: string,
  getTarget: ZipEntryTarget
) => {
  const writes: Promise<void>[] = []
  const names = new Set<string>()
  let failure: Error | undefined

  const unzip = new Unzip((file) => {
    if (failure) return
    if (file.name.endsWith('/')) return
    if (names.has(file.name)) {
      failure = new InvalidZipError()
      return
    }
    names.add(file.name)
    const segments = getTarget(file.name)
    if (segments === undefined) {
      failure = new InvalidZipError()
      return
    }
    if (segments === null) {
      file.ondata = (error) => {
        if (error) failure = error
      }
      file.start()
      return
    }
    const target = path.join(folder, ...segments)
    writes.push(
      (async () => {
        await mkdir(path.dirname(target), { recursive: true })
        const stream = createWriteStream(target)
        file.ondata = (error, data, final) => {
          if (error) {
            failure = error
            stream.destroy(error)
            return
          }
          stream.write(data)
          if (final) stream.end()
        }
        file.start()
        await finished(stream)
      })()
    )
  })
  unzip.register(UnzipInflate)

  try {
    for await (const chunk of archive) {
      unzip.push(chunk)
      if (failure) break
    }
    if (!failure) unzip.push(new Uint8Array(0), true)
  } catch (error) {
    failure ??= error instanceof Error ? error : new Error(String(error))
  }

  const results = await Promise.allSettled(writes)
  if (failure || results.some(({ status }) => status === 'rejected')) {
    throw new InvalidZipError()
  }
  return names
}
