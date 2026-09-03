import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as yaml from 'js-yaml'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mergeMacUpdateInfo } from './desktop-release-update-info.ts'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function createTemporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-release-'))
  temporaryRoots.push(root)
  return root
}

function updateInfo(arch: 'arm64' | 'x64', version = '1.2.3'): Record<string, unknown> {
  const zip = `Mantur-Agent-macOS-${arch}.zip`
  return {
    version,
    files: [
      { url: zip, sha512: `${arch}-zip`, size: 10 },
      { url: `Mantur-Agent-macOS-${arch}.dmg`, sha512: `${arch}-dmg`, size: 20 },
    ],
    path: zip,
    sha512: `${arch}-zip`,
    releaseDate: '2026-09-03T00:00:00.000Z',
  }
}

function writeYaml(root: string, name: string, value: unknown): string {
  const path = join(root, name)
  writeFileSync(path, yaml.dump(value))
  return path
}

function writeUpdateInfo(root: string, arch: 'arm64' | 'x64', version = '1.2.3'): string {
  return writeYaml(root, `${arch}.yml`, updateInfo(arch, version))
}

describe('desktop release update metadata', () => {
  it('combines both native architectures into one GitHub channel file', () => {
    const root = createTemporaryRoot()
    const output = join(root, 'latest-mac.yml')
    const merged = mergeMacUpdateInfo(
      writeUpdateInfo(root, 'arm64'),
      writeUpdateInfo(root, 'x64'),
      output,
    )

    expect(merged.files.map(file => file.url)).toEqual([
      'Mantur-Agent-macOS-x64.zip',
      'Mantur-Agent-macOS-x64.dmg',
      'Mantur-Agent-macOS-arm64.zip',
      'Mantur-Agent-macOS-arm64.dmg',
    ])
    expect(merged.path).toBe('Mantur-Agent-macOS-x64.zip')
    expect(yaml.load(readFileSync(output, 'utf8'))).toEqual(merged)
  })

  it('rejects mismatched versions and unsafe release asset names', () => {
    const root = createTemporaryRoot()
    expect(() => mergeMacUpdateInfo(
      writeUpdateInfo(root, 'arm64', '1.2.3'),
      writeUpdateInfo(root, 'x64', '1.2.4'),
      join(root, 'version.yml'),
    )).toThrow('macOS update versions differ')

    const unsafe = writeUpdateInfo(root, 'arm64')
    writeFileSync(unsafe, readFileSync(unsafe, 'utf8').replace('Mantur-Agent', '漫途Agent'))
    expect(() => mergeMacUpdateInfo(
      unsafe,
      writeUpdateInfo(root, 'x64'),
      join(root, 'unsafe.yml'),
    )).toThrow('GitHub-incompatible asset name')
  })

  it('rejects malformed update metadata and update files', () => {
    const root = createTemporaryRoot()
    const x64 = writeUpdateInfo(root, 'x64')
    const output = join(root, 'output.yml')
    const invalidMetadata: unknown[] = [
      null,
      [],
      { ...updateInfo('arm64'), version: 1 },
      { ...updateInfo('arm64'), files: {} },
      { ...updateInfo('arm64'), path: 1 },
      { ...updateInfo('arm64'), sha512: 1 },
      { ...updateInfo('arm64'), releaseDate: 1 },
    ]
    for (const [index, value] of invalidMetadata.entries()) {
      expect(() => mergeMacUpdateInfo(
        writeYaml(root, `invalid-metadata-${index}.yml`, value),
        x64,
        output,
      )).toThrow('is not valid macOS update metadata')
    }

    const invalidFiles: unknown[] = [
      null,
      [],
      { url: 1, sha512: 'checksum', size: 10 },
      { url: 'Mantur-Agent-macOS-arm64.zip', sha512: 1, size: 10 },
      { url: 'Mantur-Agent-macOS-arm64.zip', sha512: 'checksum', size: '10' },
    ]
    for (const [index, file] of invalidFiles.entries()) {
      const value = { ...updateInfo('arm64'), files: [file] }
      expect(() => mergeMacUpdateInfo(
        writeYaml(root, `invalid-file-${index}.yml`, value),
        x64,
        output,
      )).toThrow('contains an invalid update file')
    }
  })

  it('accepts metadata without a release date', () => {
    const root = createTemporaryRoot()
    const arm64 = updateInfo('arm64')
    const x64 = updateInfo('x64')
    delete arm64.releaseDate
    delete x64.releaseDate
    const merged = mergeMacUpdateInfo(
      writeYaml(root, 'arm64.yml', arm64),
      writeYaml(root, 'x64.yml', x64),
      join(root, 'output.yml'),
    )
    expect(merged).not.toHaveProperty('releaseDate')
  })

  it('requires exactly one native ZIP for each architecture', () => {
    const root = createTemporaryRoot()
    const x64 = writeUpdateInfo(root, 'x64')
    const missing = updateInfo('arm64')
    missing.files = [{ url: 'Mantur-Agent-macOS-arm64.dmg', sha512: 'dmg', size: 20 }]
    expect(() => mergeMacUpdateInfo(
      writeYaml(root, 'missing.yml', missing),
      x64,
      join(root, 'missing-output.yml'),
    )).toThrow('must contain exactly one arm64 ZIP update file')

    const duplicate = updateInfo('arm64')
    ;(duplicate.files as unknown[]).push({ url: 'Second-arm64.zip', sha512: 'second', size: 10 })
    expect(() => mergeMacUpdateInfo(
      writeYaml(root, 'duplicate.yml', duplicate),
      x64,
      join(root, 'duplicate-output.yml'),
    )).toThrow('must contain exactly one arm64 ZIP update file')
  })

  it('rejects duplicate release asset names across native metadata', () => {
    const root = createTemporaryRoot()
    const arm64 = updateInfo('arm64')
    const x64 = updateInfo('x64')
    const arm64Files = arm64.files as Array<Record<string, unknown>>
    const x64Files = x64.files as Array<Record<string, unknown>>
    arm64Files[1]!.url = 'shared.dmg'
    x64Files[1]!.url = 'shared.dmg'
    expect(() => mergeMacUpdateInfo(
      writeYaml(root, 'arm64.yml', arm64),
      writeYaml(root, 'x64.yml', x64),
      join(root, 'output.yml'),
    )).toThrow('contains duplicate asset names')
  })

  it('executes the command-line entry and rejects missing paths', async () => {
    const originalArgv = process.argv
    const root = createTemporaryRoot()
    try {
      vi.resetModules()
      process.argv = [
        process.execPath,
        join(import.meta.dirname, 'desktop-release-update-info.ts'),
        writeUpdateInfo(root, 'arm64'),
        writeUpdateInfo(root, 'x64'),
        join(root, 'cli-output.yml'),
      ]
      await import('./desktop-release-update-info.ts')
      expect(readFileSync(join(root, 'cli-output.yml'), 'utf8')).toContain('Mantur-Agent-macOS-arm64.zip')

      vi.resetModules()
      process.argv = [process.execPath, join(import.meta.dirname, 'desktop-release-update-info.ts')]
      await expect(import('./desktop-release-update-info.ts')).rejects.toThrow('usage: desktop-release-update-info')
    } finally {
      process.argv = originalArgv
      vi.resetModules()
    }
  })
})
