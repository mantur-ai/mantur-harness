/** Bounded archive inspection and extraction for ManturHub Skill bundles. */

import { execFile } from 'node:child_process'
import { lstat, mkdtemp, readdir, rename, rm } from 'node:fs/promises'
import { dirname, join, posix } from 'node:path'

/** Limits applied before and after extracting one Skill archive. */
export interface ArchiveLimits {
  /** Maximum number of archive entries and extracted files. */
  readonly maxFiles: number
  /** Maximum verified byte total after extraction. */
  readonly maxUnpackedBytes: number
  /** Maximum stdout retained from each archive inspection command. */
  readonly maxListingBytes: number
}

interface ArchiveTool {
  readonly command: string
  readonly list: readonly string[]
  readonly verbose: readonly string[]
  readonly summary?: readonly string[]
  readonly extract: (destination: string) => readonly string[]
}

interface ArchiveInspection {
  readonly entries: readonly string[]
  readonly verbose: string
  readonly unpackedBytes: number
}

const tools = (archive: string): readonly ArchiveTool[] => [
  {
    command: 'unzip',
    list: ['-Z1', archive],
    verbose: ['-Z', '-l', archive],
    summary: ['-Z', '-t', archive],
    extract: destination => ['-o', '-q', archive, '-d', destination],
  },
  {
    command: 'tar',
    list: ['-tf', archive],
    verbose: ['-tvf', archive],
    extract: destination => ['-xf', archive, '-C', destination],
  },
]

/** Execute one system archive command with bounded captured output. */
function execute(command: string, args: readonly string[], maxBuffer: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: 'utf8', maxBuffer }, (error, stdout) => {
      if (error !== null) {
        reject(Object.assign(new Error('Archive command failed', { cause: error }), { code: error.code }))
      }
      else resolve(stdout)
    })
  })
}

/** Return whether the platform does not provide one candidate extractor. */
function isMissingCommand(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

/** Read the total uncompressed size declared by the selected archive tool. */
function declaredBytes(tool: ArchiveTool, verbose: string, summary: string): number {
  if (tool.command === 'unzip') {
    const match = summary.match(/([\d,]+)\s+bytes? uncompressed/i)
    if (match === null) return Number.NaN
    const [declaration] = match
    return Number(declaration.replaceAll(',', '').split(' ')[0])
  }
  let total = 0
  for (const line of verbose.split(/\r?\n/).filter(Boolean)) {
    const bsd = line.match(/^\S+\s+\d+\s+\S+\s+\S+\s+(\d+)\s+/)
    const gnu = line.match(/^\S+\s+\S+\s+(\d+)\s+/)
    const match = bsd ?? gnu
    if (match === null) return Number.NaN
    const size = Number(match[1])
    if (!Number.isFinite(size)) return Number.NaN
    total += size
  }
  return total
}

/** Inspect one archive without writing any entry. */
async function inspect(tool: ArchiveTool, limits: ArchiveLimits): Promise<ArchiveInspection> {
  const [listed, verbose, summary] = await Promise.all([
    execute(tool.command, tool.list, limits.maxListingBytes),
    execute(tool.command, tool.verbose, limits.maxListingBytes),
    tool.summary === undefined ? Promise.resolve('') : execute(tool.command, tool.summary, limits.maxListingBytes),
  ])
  return {
    entries: listed.split(/\r?\n/).filter(Boolean),
    verbose,
    unpackedBytes: declaredBytes(tool, verbose, summary),
  }
}

/** Reject paths, links, file counts, and declared expansion outside policy. */
function validateInspection(inspection: ArchiveInspection, limits: ArchiveLimits): void {
  if (inspection.entries.length === 0) throw new Error('Skill archive is empty')
  if (inspection.entries.length > limits.maxFiles) {
    throw new Error(`Skill archive contains more than ${limits.maxFiles} entries`)
  }
  if (!Number.isFinite(inspection.unpackedBytes) || inspection.unpackedBytes < 0) {
    throw new Error('Skill archive uncompressed size could not be verified')
  }
  if (inspection.unpackedBytes > limits.maxUnpackedBytes) {
    throw new Error(`Skill archive expands beyond ${limits.maxUnpackedBytes} bytes`)
  }
  if (/^\s*[lh][rwx-]{9}\s/m.test(inspection.verbose)) {
    throw new Error('Skill archive must not contain symbolic or hard links')
  }
  const names = new Set<string>()
  for (const raw of inspection.entries) {
    const name = raw.replaceAll('\\', '/')
    const normalized = posix.normalize(name)
    const collisionKey = normalized.toLowerCase()
    if (name.includes('\0')
      || /[\x00-\x1f\x7f]/.test(name)
      || name.startsWith('/')
      || /^[a-z]:\//i.test(name)
      || normalized === '.'
      || normalized === '..'
      || normalized.startsWith('../')) {
      throw new Error(`Skill archive contains an unsafe path: ${raw}`)
    }
    if (names.has(collisionKey)) throw new Error(`Skill archive contains a duplicate path: ${raw}`)
    names.add(collisionKey)
  }
}

/** Recheck the extracted filesystem without following links. */
async function inspectExtracted(root: string, limits: ArchiveLimits): Promise<void> {
  let files = 0
  let bytes = 0
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (/[\x00-\x1f\x7f]/.test(entry.name)) {
        throw new Error(`Skill archive contains an unsafe filename: ${JSON.stringify(entry.name)}`)
      }
      const path = join(directory, entry.name)
      const stat = await lstat(path)
      if (stat.isSymbolicLink()) throw new Error(`Skill archive contains a symbolic link: ${entry.name}`)
      if (stat.isDirectory()) {
        await walk(path)
      } else if (stat.isFile()) {
        files += 1
        bytes += stat.size
        if (files > limits.maxFiles) throw new Error(`Skill archive contains more than ${limits.maxFiles} files`)
        if (bytes > limits.maxUnpackedBytes) {
          throw new Error(`Skill archive expands beyond ${limits.maxUnpackedBytes} bytes`)
        }
      } else {
        throw new Error(`Skill archive contains an unsupported file type: ${entry.name}`)
      }
    }
  }
  await walk(root)
}

/**
 * Safely extract a ZIP with the first available system extractor.
 *
 * @param archive - Downloaded archive path.
 * @param destination - New directory path that receives verified contents.
 * @param limits - Entry, byte, and command-output limits.
 * @returns A promise resolved after the verified directory is atomically placed.
 */
export async function extractArchive(archive: string, destination: string, limits: ArchiveLimits): Promise<void> {
  let found = false
  for (const tool of tools(archive)) {
    let inspection: ArchiveInspection
    try {
      inspection = await inspect(tool, limits)
      found = true
    } catch (error) {
      if (!isMissingCommand(error)) found = true
      continue
    }
    validateInspection(inspection, limits)
    const temporary = await mkdtemp(join(dirname(destination), '.extract-'))
    try {
      try {
        await execute(tool.command, tool.extract(temporary), limits.maxListingBytes)
      } catch {
        // This inspected extractor rejected the archive; try the next available implementation.
        continue
      }
      await inspectExtracted(temporary, limits)
      await rename(temporary, destination)
      return
    } finally {
      await rm(temporary, { recursive: true, force: true })
    }
  }
  if (found) throw new Error('Skill archive is invalid, damaged, or could not be extracted')
  throw new Error('Skill archive extraction requires the system tar or unzip command')
}
