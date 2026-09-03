import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { afterEach, describe, expect, it } from 'vitest'
import { assertArchiveEntrySize, extractArchive } from '../src/archive.ts'

const cleanups: string[] = []
const limits = { maxFiles: 10, maxUnpackedBytes: 100 }

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function paths(archive: Uint8Array): Promise<{ readonly archive: string; readonly destination: string }> {
  const root = await mkdtemp(join(tmpdir(), 'archive-test-'))
  cleanups.push(root)
  const archivePath = join(root, 'bundle.zip')
  await writeFile(archivePath, archive)
  return { archive: archivePath, destination: join(root, 'skill') }
}

function bundle(files: Record<string, string>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, value]) => [name, strToU8(value)])))
}

function patchZipNumber(archive: Uint8Array, localOffset: number, centralOffset: number, value: number): Uint8Array {
  const copy = Uint8Array.from(archive)
  const view = new DataView(copy.buffer)
  for (let offset = 0; offset <= copy.byteLength - 4; offset += 1) {
    const signature = view.getUint32(offset, true)
    if (signature === 0x04034b50) view.setUint32(offset + localOffset, value, true)
    if (signature === 0x02014b50) view.setUint32(offset + centralOffset, value, true)
  }
  return copy
}

function patchFilenameByte(archive: Uint8Array, filename: string, index: number, value: number): Uint8Array {
  const match = new TextEncoder().encode(filename)
  const copy = Uint8Array.from(archive)
  for (let offset = 0; offset <= copy.byteLength - filename.length; offset += 1) {
    if (match.every((_, byte) => copy[offset + byte] === match[byte])) copy[offset + index] = value
  }
  return copy
}

function markUtf8Names(archive: Uint8Array): Uint8Array {
  const copy = Uint8Array.from(archive)
  const view = new DataView(copy.buffer)
  for (let offset = 0; offset <= copy.byteLength - 10; offset += 1) {
    const signature = view.getUint32(offset, true)
    if (signature === 0x04034b50) view.setUint16(offset + 6, view.getUint16(offset + 6, true) | 0x800, true)
    if (signature === 0x02014b50) view.setUint16(offset + 8, view.getUint16(offset + 8, true) | 0x800, true)
  }
  return copy
}

describe('marketplace bounded ZIP extraction', () => {
  it('streams regular files and creates nested directories', async () => {
    const subject = await paths(bundle({ 'SKILL.md': 'root', 'references/guide.md': 'guide' }))

    await expect(extractArchive(subject.archive, subject.destination, limits)).resolves.toBeUndefined()
    await expect(readFile(join(subject.destination, 'SKILL.md'), 'utf8')).resolves.toBe('root')
    await expect(readFile(join(subject.destination, 'references', 'guide.md'), 'utf8')).resolves.toBe('guide')
  })

  it('rejects empty, damaged, and unsupported-compression archives', async () => {
    const empty = await paths(zipSync({}))
    await expect(extractArchive(empty.archive, empty.destination, limits)).rejects.toThrow('empty')

    const damaged = await paths(strToU8('not a zip'))
    await expect(extractArchive(damaged.archive, damaged.destination, limits)).rejects.toThrow()

    const unsupportedBytes = patchZipNumber(bundle({ 'SKILL.md': 'root' }), 8, 10, 99)
    const unsupported = await paths(unsupportedBytes)
    await expect(extractArchive(unsupported.archive, unsupported.destination, limits)).rejects.toThrow()
  })

  it('enforces the entry count before extracting an extra file', async () => {
    const subject = await paths(bundle({ one: '1', two: '2' }))
    await expect(extractArchive(subject.archive, subject.destination, { ...limits, maxFiles: 1 }))
      .rejects.toThrow('more than 1')
  })

  it('rejects declared expansion before writing archive contents', async () => {
    const subject = await paths(bundle({ large: 'x'.repeat(101) }))
    await expect(extractArchive(subject.archive, subject.destination, limits)).rejects.toThrow('expands beyond')
  })

  it('rejects an unsafe ZIP64 entry size before arithmetic or extraction', () => {
    expect(() => { assertArchiveEntrySize('huge', Number.MAX_SAFE_INTEGER + 1) }).toThrow('entry size')
    expect(() => { assertArchiveEntrySize('negative', -1) }).toThrow('entry size')
  })

  it('aborts a lying entry while streaming and removes its partial staging tree', async () => {
    const archive = patchZipNumber(bundle({ large: 'x'.repeat(101) }), 22, 24, 1)
    const subject = await paths(archive)

    await expect(extractArchive(subject.archive, subject.destination, { ...limits, maxUnpackedBytes: 50 }))
      .rejects.toThrow('expands beyond')
    expect(await readdir(dirname(subject.destination))).toEqual(['bundle.zip'])
  })

  it('rejects an entry whose declared and streamed sizes differ below the global limit', async () => {
    const archive = patchZipNumber(bundle({ file: 'content' }), 22, 24, 1)
    const subject = await paths(archive)
    await expect(extractArchive(subject.archive, subject.destination, limits)).rejects.toThrow('entry size')
  })

  it.each([
    '../escape',
    'folder/../escape',
    '/absolute',
    'C:/drive',
    'folder\\file',
    'stream:secret',
    'angle<name',
    'quote"name',
    'pipe|name',
    'question?name',
    'star*name',
    'tail.',
    'tail ',
    'CON',
    'prn.txt',
    'AUX',
    'nul.json',
    'COM1.log',
    'lpt9',
  ])('rejects the cross-platform unsafe path %j', async (name) => {
    const subject = await paths(bundle({ [name]: 'x' }))
    await expect(extractArchive(subject.archive, subject.destination, limits)).rejects.toThrow()
  })

  it('rejects a control character encoded directly in an entry name', async () => {
    const archive = markUtf8Names(patchFilenameByte(bundle({ badXname: 'x' }), 'badXname', 3, 0x0a))
    const subject = await paths(archive)
    await expect(extractArchive(subject.archive, subject.destination, limits)).rejects.toThrow('unsafe path')
  })

  it('rejects case-insensitive normalized path collisions', async () => {
    const subject = await paths(bundle({ 'Folder/File': 'one', 'folder/file': 'two' }))
    await expect(extractArchive(subject.archive, subject.destination, limits)).rejects.toThrow('duplicate path')
  })

  it('accepts an explicit Unix directory entry', async () => {
    const archive = zipSync({ 'folder/': [strToU8(''), { os: 3, attrs: 0o040755 << 16 }] })
    const subject = await paths(archive)
    await expect(extractArchive(subject.archive, subject.destination, limits)).resolves.toBeUndefined()
    await expect(readdir(subject.destination)).resolves.toEqual(['folder'])
  })

  it.each([
    ['symbolic link', 0o120777],
    ['special node', 0o010666],
  ] as const)('rejects a Unix %s entry without materializing it', async (_label, mode) => {
    const archive = zipSync({ link: [strToU8('target'), { os: 3, attrs: mode << 16 }] })
    const subject = await paths(archive)
    await expect(extractArchive(subject.archive, subject.destination, limits)).rejects.toThrow('unsupported file type')
  })

  it('rejects a Unix directory mode whose path claims to be a regular file', async () => {
    const archive = zipSync({ file: [strToU8(''), { os: 3, attrs: 0o040755 << 16 }] })
    const subject = await paths(archive)
    await expect(extractArchive(subject.archive, subject.destination, limits)).rejects.toThrow('does not match')
  })
})
