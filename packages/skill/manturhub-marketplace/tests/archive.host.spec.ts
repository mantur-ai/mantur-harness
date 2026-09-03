import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const command = vi.hoisted(() => ({ mode: 'zip', list: 'SKILL.md\n', verbose: '', summary: '1 byte uncompressed\n' }))

vi.mock('node:child_process', async importOriginal => ({
  ...await importOriginal<typeof import('node:child_process')>(),
  execFile: (name: string, args: string[], options: unknown, callback: (error: Error | null, stdout: string) => void) => {
    void options
    if (command.mode === 'missing' || (command.mode === 'tar' && name === 'unzip')) {
      const error = Object.assign(new Error('missing'), { code: 'ENOENT' })
      callback(error, '')
      return
    }
    if (command.mode === 'damaged') {
      callback(new Error('damaged'), '')
      return
    }
    if (args.includes('-Z1') || args.includes('-tf')) callback(null, command.list)
    else if (args.includes('-t')) callback(null, command.summary)
    else if (args.includes('-Z')) callback(null, command.verbose || '-rw-r--r--  1 x x 1 Jan 1 00:00 SKILL.md\n')
    else if (args.includes('-tvf')) callback(null, command.verbose || '-rw-r--r-- 1 x x 1 Jan 1 00:00 SKILL.md\n')
    else if (command.mode === 'extract-fail') callback(new Error('extract failed'), '')
    else {
      const destination = args.at(-1) as string
      void mkdir(destination, { recursive: true })
        .then(async () => {
          if (command.mode === 'post-control') await writeFile(join(destination, 'bad\nname'), 'x')
          else if (command.mode === 'post-symlink') await symlink('SKILL.md', join(destination, 'link'))
          else if (command.mode === 'post-many') {
            await writeFile(join(destination, 'one'), 'x')
            await writeFile(join(destination, 'two'), 'x')
          } else if (command.mode === 'post-large') await writeFile(join(destination, 'large'), 'x'.repeat(101))
          else if (command.mode === 'post-special') execFileSync('mkfifo', [join(destination, 'pipe')])
          else {
            await mkdir(join(destination, 'nested'), { recursive: true })
            await writeFile(join(destination, 'nested', 'SKILL.md'), 'x')
          }
        })
        .then(() => { callback(null, '') })
    }
  },
}))

import { extractArchive } from '../src/archive.ts'

const cleanups: string[] = []
const limits = { maxFiles: 10, maxUnpackedBytes: 100, maxListingBytes: 10_000 }

afterEach(async () => {
  command.mode = 'zip'
  command.list = 'SKILL.md\n'
  command.verbose = ''
  command.summary = '1 byte uncompressed\n'
  await Promise.all(cleanups.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function paths() {
  const root = await mkdtemp(join(tmpdir(), 'archive-test-'))
  cleanups.push(root)
  return { archive: join(root, 'bundle.zip'), destination: join(root, 'skill') }
}

describe('marketplace archive extraction', () => {
  it.each(['zip', 'tar'] as const)('extracts with the available %s implementation', async (mode) => {
    command.mode = mode
    const subject = await paths()
    await expect(extractArchive(subject.archive, subject.destination, limits)).resolves.toBeUndefined()
  })

  it('reports missing and damaged platform extractors', async () => {
    const missing = await paths()
    command.mode = 'missing'
    await expect(extractArchive(missing.archive, missing.destination, limits)).rejects.toThrow('requires')
    const damaged = await paths()
    command.mode = 'damaged'
    await expect(extractArchive(damaged.archive, damaged.destination, limits)).rejects.toThrow('invalid')
  })

  it.each([
    ['', 'empty'],
    ['a\nb\n', 'more than 1'],
    ['../escape\n', 'unsafe path'],
    ['/absolute\n', 'unsafe path'],
    ['C:/drive\n', 'unsafe path'],
    ['a\na\n', 'duplicate path'],
  ])('rejects the archive entry listing %j', async (list, message) => {
    const subject = await paths()
    command.list = list
    const maxFiles = message === 'more than 1' ? 1 : limits.maxFiles
    await expect(extractArchive(subject.archive, subject.destination, { ...limits, maxFiles }))
      .rejects.toThrow(message)
  })

  it('rejects unverifiable and excessive expansion plus declared links', async () => {
    const unknown = await paths()
    command.summary = 'unknown\n'
    await expect(extractArchive(unknown.archive, unknown.destination, limits)).rejects.toThrow('verified')
    const large = await paths()
    command.summary = '101 bytes uncompressed\n'
    await expect(extractArchive(large.archive, large.destination, limits)).rejects.toThrow('expands beyond')
    const link = await paths()
    command.summary = '1 byte uncompressed\n'
    command.verbose = 'lrwxr-xr-x 1 x x 1 Jan 1 00:00 link\n'
    await expect(extractArchive(link.archive, link.destination, limits)).rejects.toThrow('links')
  })

  it('accepts GNU tar sizes and rejects malformed tar listings', async () => {
    command.mode = 'tar'
    command.verbose = '-rw-r--r-- x/x 1 Jan 1 00:00 SKILL.md\n'
    const valid = await paths()
    await expect(extractArchive(valid.archive, valid.destination, limits)).resolves.toBeUndefined()

    command.verbose = 'not a tar listing\n'
    const malformed = await paths()
    await expect(extractArchive(malformed.archive, malformed.destination, limits)).rejects.toThrow('verified')

    command.verbose = `-rw-r--r-- x/x ${'9'.repeat(400)} Jan 1 00:00 SKILL.md\n`
    const infinite = await paths()
    await expect(extractArchive(infinite.archive, infinite.destination, limits)).rejects.toThrow('verified')
  })

  it.each([
    ['post-control', 'unsafe filename', limits],
    ['post-symlink', 'symbolic link', limits],
    ['post-many', 'more than 1', { ...limits, maxFiles: 1 }],
    ['post-large', 'expands beyond', limits],
    ['post-special', 'unsupported file type', limits],
  ])('rechecks extracted filesystem mode %s', async (mode, message, activeLimits) => {
    command.mode = mode
    const subject = await paths()
    await expect(extractArchive(subject.archive, subject.destination, activeLimits)).rejects.toThrow(message)
  })

  it('tries the next extractor when extraction fails after inspection', async () => {
    command.mode = 'extract-fail'
    const subject = await paths()
    await expect(extractArchive(subject.archive, subject.destination, limits)).rejects.toThrow('invalid')
  })
})
