/** Desktop-owned data paths and explicit cache recovery. */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  canResetProjectionCache,
  desktopPaths,
  desktopUserDataPath,
  prepareDesktopPaths,
  resetProjectionCache,
} from '../src/desktop-state.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('desktop state', () => {
  it('isolates Harness data and process files below stable application data', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mantur-desktop-state-'))
    roots.push(root)
    const userData = desktopUserDataPath(root)
    const paths = desktopPaths(userData)

    expect(paths).toEqual({
      userData: join(root, 'mantur-agent'),
      dshHome: join(root, 'mantur-agent', 'harness'),
      launchRoot: join(root, 'mantur-agent', 'launch-root'),
      logPath: join(root, 'mantur-agent', 'logs', 'harness.log'),
    })
    await prepareDesktopPaths(paths)
    await expect(mkdir(paths.dshHome)).rejects.toMatchObject({ code: 'EEXIST' })
    await expect(mkdir(paths.launchRoot)).rejects.toMatchObject({ code: 'EEXIST' })
  })

  it('keeps development data separate from installed application data', () => {
    expect(desktopUserDataPath('/application-data', 'development')).toBe(
      join('/application-data', 'mantur-agent-dev'),
    )
    expect(desktopUserDataPath('/application-data', 'release')).toBe(
      join('/application-data', 'mantur-agent'),
    )
  })

  it('removes only current and legacy projection caches after approval', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mantur-desktop-state-'))
    roots.push(root)
    const dshHome = join(root, 'harness')
    const current = join(dshHome, 'storages', 'session_projcache', 'sessions', 'stale.json')
    const legacy = join(dshHome, 'storages', 'session_projcache.json')
    const session = join(dshHome, 'sessions', 'keep.jsonl')
    await Promise.all([
      mkdir(join(current, '..'), { recursive: true }),
      mkdir(join(session, '..'), { recursive: true }),
    ])
    await Promise.all([
      writeFile(current, 'stale'),
      writeFile(legacy, 'legacy'),
      writeFile(session, 'session'),
    ])

    await resetProjectionCache(dshHome)

    await expect(readFile(current)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(legacy)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(session, 'utf8')).resolves.toBe('session')
  })

  it('recognizes only the projection-cache schema failure and refuses broad roots', async () => {
    expect(canResetProjectionCache(new Error(
      "domain 'session_projcache': stored record 'x' does not match its schema",
    ))).toBe(true)
    expect(canResetProjectionCache(new Error('another startup failure'))).toBe(false)
    await expect(resetProjectionCache('/tmp/not-desktop-data')).rejects.toThrow(
      'refusing to reset projection cache outside a desktop Harness home',
    )
  })
})
