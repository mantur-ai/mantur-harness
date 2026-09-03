/** Streaming bounded ZIP extraction for ManturHub Skill bundles. */

import { mkdir, mkdtemp, open, rename, rm } from 'node:fs/promises'
import { dirname, join, posix } from 'node:path'
import type { Readable } from 'node:stream'
import { open as openZipFile, type Entry, type ZipFile } from 'yauzl'

/** Limits applied while extracting one Skill archive. */
export interface ArchiveLimits {
  /** Maximum number of archive entries. */
  readonly maxFiles: number
  /** Maximum cumulative bytes written from archive entries. */
  readonly maxUnpackedBytes: number
}

interface EntryTarget {
  readonly directory: boolean
  readonly path: string
}

const unixHost = 3
const unixTypeMask = 0o170000
const unixDirectory = 0o040000
const unixRegular = 0o100000
const windowsDeviceName = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

/**
 * Reject an entry size that cannot participate in exact bounded arithmetic.
 * @param entryName - ZIP entry name used in the error.
 * @param size - Uncompressed byte count decoded from the central directory.
 */
export function assertArchiveEntrySize(entryName: string, size: number): void {
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error(`Skill archive entry size is invalid: ${entryName}`)
  }
}

/** Open one ZIP without automatically closing its descriptor between entries. */
function openZip(archive: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    openZipFile(archive, {
      autoClose: false,
      lazyEntries: true,
      strictFileNames: true,
      validateEntrySizes: false,
    }, (error, zip) => {
      if (error !== null) reject(error)
      else resolve(zip)
    })
  })
}

/** Read the next central-directory entry from a lazy ZIP reader. */
function nextEntry(zip: ZipFile): Promise<Entry | undefined> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      zip.off('entry', onEntry)
      zip.off('end', onEnd)
      zip.off('error', onError)
    }
    const onEntry = (entry: Entry): void => {
      cleanup()
      resolve(entry)
    }
    const onEnd = (): void => {
      cleanup()
      resolve(undefined)
    }
    const onError = (error: Error): void => {
      cleanup()
      reject(error)
    }
    zip.once('entry', onEntry)
    zip.once('end', onEnd)
    zip.once('error', onError)
    zip.readEntry()
  })
}

/** Open a validated entry's decompressed byte stream. */
function openEntry(zip: ZipFile, entry: Entry): Promise<Readable> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error !== null) reject(error)
      else resolve(stream)
    })
  })
}

/** Validate one ZIP entry and resolve its path inside the staging directory. */
function entryTarget(entry: Entry, root: string, names: Set<string>): EntryTarget {
  const raw = entry.fileName
  const name = raw.replaceAll('\\', '/')
  const directory = name.endsWith('/')
  const normalized = posix.normalize(name)
  const relativeName = directory ? normalized.replace(/\/$/, '') : normalized
  const segments = relativeName.split('/')
  if (name.includes('\0')
    || /[\x00-\x1f\x7f]/.test(name)
    || name.startsWith('/')
    || /^[a-z]:\//i.test(name)
    || relativeName === ''
    || relativeName === '.'
    || relativeName === '..'
    || relativeName.startsWith('../')
    || name.split('/').some(segment => segment === '.' || segment === '..')
    || segments.some(segment => /[<>:"|?*]/.test(segment)
      || /[ .]$/.test(segment)
      || windowsDeviceName.test(segment))) {
    throw new Error(`Skill archive contains an unsafe path: ${raw}`)
  }
  const collisionKey = relativeName.toLowerCase()
  if (names.has(collisionKey)) throw new Error(`Skill archive contains a duplicate path: ${raw}`)
  names.add(collisionKey)

  const madeBy = entry.versionMadeBy >>> 8
  const unixType = madeBy === unixHost ? (entry.externalFileAttributes >>> 16) & unixTypeMask : 0
  if (unixType !== 0 && unixType !== unixRegular && unixType !== unixDirectory) {
    throw new Error(`Skill archive contains a link or unsupported file type: ${raw}`)
  }
  if ((unixType === unixDirectory) !== directory && unixType !== 0) {
    throw new Error(`Skill archive entry type does not match its path: ${raw}`)
  }
  return { directory, path: join(root, ...relativeName.split('/')) }
}

/** Stream one regular file while enforcing the cumulative write limit. */
async function writeEntry(
  zip: ZipFile,
  entry: Entry,
  target: string,
  maxBytes: number,
  written: { value: number },
): Promise<void> {
  await mkdir(dirname(target), { recursive: true })
  const handle = await open(target, 'wx', 0o600)
  let entryBytes = 0
  try {
    const stream = await openEntry(zip, entry)
    for await (const chunk of stream) {
      const bytes = chunk as Uint8Array
      if (written.value + bytes.byteLength > maxBytes) {
        stream.destroy()
        throw new Error(`Skill archive expands beyond ${maxBytes} bytes`)
      }
      await handle.write(bytes)
      written.value += bytes.byteLength
      entryBytes += bytes.byteLength
    }
    if (entryBytes !== entry.uncompressedSize) throw new Error(`Skill archive entry size is invalid: ${entry.fileName}`)
  } catch (error) {
    await handle.close()
    await rm(target, { force: true })
    throw error
  }
  await handle.close()
}

/**
 * Extract a ZIP into a new directory while bounding every filesystem write.
 *
 * @param archive - Downloaded ZIP path.
 * @param destination - New directory path that receives verified contents.
 * @param limits - Entry and cumulative uncompressed-byte limits.
 * @returns A promise resolved after the verified directory is atomically placed.
 */
export async function extractArchive(archive: string, destination: string, limits: ArchiveLimits): Promise<void> {
  const temporary = await mkdtemp(join(dirname(destination), '.extract-'))
  let zip: ZipFile | undefined
  try {
    zip = await openZip(archive)
    const names = new Set<string>()
    const written = { value: 0 }
    let entries = 0
    let declaredBytes = 0
    while (true) {
      const entry = await nextEntry(zip)
      if (entry === undefined) break
      entries += 1
      if (entries > limits.maxFiles) {
        throw new Error(`Skill archive contains more than ${limits.maxFiles} entries`)
      }
      assertArchiveEntrySize(entry.fileName, entry.uncompressedSize)
      declaredBytes += entry.uncompressedSize
      if (declaredBytes > limits.maxUnpackedBytes) {
        throw new Error(`Skill archive expands beyond ${limits.maxUnpackedBytes} bytes`)
      }
      const target = entryTarget(entry, temporary, names)
      if (target.directory) await mkdir(target.path, { recursive: true })
      else await writeEntry(zip, entry, target.path, limits.maxUnpackedBytes, written)
    }
    if (entries === 0) throw new Error('Skill archive is empty')
    zip.close()
    zip = undefined
    await rename(temporary, destination)
  } finally {
    zip?.close()
    await rm(temporary, { recursive: true, force: true })
  }
}
