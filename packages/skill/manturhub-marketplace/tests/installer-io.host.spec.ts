import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { strToU8, zipSync } from 'fflate'
import { afterEach, describe, expect, it, vi } from 'vitest'

const faults = vi.hoisted(() => ({
  backupRename: false,
  cleanup: false,
  destinationLstat: false,
  removeDestination: false,
  recoveryCleanup: false,
  restoreRename: false,
  stateCommit: false,
  stagedRename: false,
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...original,
    lstat: async (path: string) => {
      if (faults.destinationLstat && basename(path) === 'story-director') {
        throw Object.assign(new Error('permission denied'), { code: 'EACCES' })
      }
      return await original.lstat(path)
    },
    rename: async (from: string, to: string) => {
      if (faults.backupRename && to.includes('/.manturhub-recovery/')) {
        throw Object.assign(new Error('backup failed'), { code: 'EACCES' })
      }
      if (faults.stateCommit && basename(to) === 'installed-skills.json') {
        throw Object.assign(new Error('state commit failed'), { code: 'EIO' })
      }
      if (faults.restoreRename && from.includes('/.manturhub-recovery/')) {
        throw Object.assign(new Error('restore failed'), { code: 'EIO' })
      }
      if (faults.stagedRename && basename(from) === 'staged') {
        throw Object.assign(new Error('commit failed'), { code: 'EIO' })
      }
      await original.rename(from, to)
    },
    rm: async (path: string, options?: Parameters<typeof original.rm>[1]) => {
      if (faults.cleanup && basename(path).startsWith('.mantur-marketplace-')) {
        throw new Error('cleanup failed')
      }
      if (faults.removeDestination && basename(path) === 'story-director') {
        throw Object.assign(new Error('remove destination failed'), { code: 'EIO' })
      }
      if (faults.recoveryCleanup && path.includes('/.manturhub-recovery/')) {
        throw new Error('recovery cleanup failed')
      }
      await original.rm(path, options)
    },
  }
})

import { installSkill, type InstallerConfig } from '../src/installer.ts'

const cleanups: string[] = []

afterEach(async () => {
  faults.backupRename = false
  faults.cleanup = false
  faults.destinationLstat = false
  faults.removeDestination = false
  faults.recoveryCleanup = false
  faults.restoreRename = false
  faults.stateCommit = false
  faults.stagedRename = false
  await Promise.all(cleanups.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function fixture(): Promise<{
  readonly config: InstallerConfig
  readonly ctx: Context
}> {
  const home = await mkdtemp(join(tmpdir(), 'dsh-installer-io-'))
  cleanups.push(home)
  const archive = zipSync({
    'SKILL.md': strToU8('---\nname: story-director\nversion: 1.2.3\n---\n'),
  })
  const ctx = new Context()
  ctx.provide('manturAccount', {
    request: () => Promise.resolve(new Response(archive)),
    status: () => Promise.resolve({
      status: 'signed-in' as const,
      account: { email: 'artist@example.com' },
    }),
  } as never)
  return {
    ctx,
    config: {
      dshHome: home,
      skillsRoot: join(home, 'skills'),
      maxBundleBytes: 1024 * 1024,
      maxFiles: 10,
      maxUnpackedBytes: 1024 * 1024,
      metadataTimeoutMs: 1000,
      downloadTimeoutMs: 1000,
    },
  }
}

describe('ManturHub marketplace installer filesystem failures', () => {
  it('propagates a destination inspection failure other than absence', async () => {
    const target = await fixture()
    faults.destinationLstat = true
    await expect(installSkill(target.ctx, 'story-director', '1.2.3', target.config))
      .rejects.toMatchObject({ code: 'EACCES' })
  })

  it('propagates a failure while moving the previous installation aside', async () => {
    const target = await fixture()
    await installSkill(target.ctx, 'story-director', '1.2.3', target.config)
    faults.backupRename = true
    await expect(installSkill(target.ctx, 'story-director', '1.2.3', target.config))
      .rejects.toMatchObject({ code: 'EACCES' })
  })

  it('leaves no destination when the initial staged rename fails', async () => {
    const target = await fixture()
    faults.stagedRename = true
    await expect(installSkill(target.ctx, 'story-director', '1.2.3', target.config))
      .rejects.toMatchObject({ code: 'EIO' })
  })

  it('reports temporary cleanup failure without changing a committed result', async () => {
    const target = await fixture()
    const warning = vi.spyOn(target.ctx.logger, 'warn')
    faults.cleanup = true
    await expect(installSkill(target.ctx, 'story-director', '1.2.3', target.config)).resolves.toEqual({
      slug: 'story-director',
      version: '1.2.3',
    })
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('cleanup failed'))
  })

  it('reports an initial state failure without inventing a recovery path', async () => {
    const target = await fixture()
    faults.stateCommit = true
    faults.removeDestination = true

    await expect(installSkill(target.ctx, 'story-director', '1.2.3', target.config))
      .rejects.not.toThrow('.manturhub-recovery/')
  })

  it('warns when an empty recovery directory cannot be removed after restoring an update', async () => {
    const target = await fixture()
    const warning = vi.spyOn(target.ctx.logger, 'warn')
    await installSkill(target.ctx, 'story-director', '1.2.3', target.config)
    faults.stateCommit = true
    faults.recoveryCleanup = true

    await expect(installSkill(target.ctx, 'story-director', '1.2.3', target.config))
      .rejects.toMatchObject({ code: 'EIO' })
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('empty recovery directory cleanup failed'))
  })

  it('warns when an obsolete recovery directory cannot be removed after a successful update', async () => {
    const target = await fixture()
    const warning = vi.spyOn(target.ctx.logger, 'warn')
    await installSkill(target.ctx, 'story-director', '1.2.3', target.config)
    faults.recoveryCleanup = true

    await expect(installSkill(target.ctx, 'story-director', '1.2.3', target.config)).resolves.toEqual({
      slug: 'story-director',
      version: '1.2.3',
    })
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('obsolete recovery directory cleanup failed'))
  })

  it('preserves the previous Skill beside its destination when removing the failed update is impossible', async () => {
    const target = await fixture()
    await installSkill(target.ctx, 'story-director', '1.2.3', target.config)
    faults.stateCommit = true
    faults.removeDestination = true

    await expect(installSkill(target.ctx, 'story-director', '1.2.3', target.config))
      .rejects.toThrow('.manturhub-recovery/')
    const fs = await import('node:fs/promises')
    const entries = await fs.readdir(target.config.skillsRoot)
    expect(entries).toEqual(['story-director'])
    const recoveryRoot = join(target.config.dshHome, '.manturhub-recovery')
    const [recoveryId] = await fs.readdir(recoveryRoot)
    await expect(fs.readFile(join(recoveryRoot, recoveryId ?? 'missing', 'story-director', 'SKILL.md'), 'utf8'))
      .resolves.toContain('name: story-director')
  })

  it('preserves and reports the previous Skill when restoring its recovery directory fails', async () => {
    const target = await fixture()
    await installSkill(target.ctx, 'story-director', '1.2.3', target.config)
    faults.stateCommit = true
    faults.restoreRename = true

    await expect(installSkill(target.ctx, 'story-director', '1.2.3', target.config))
      .rejects.toThrow('recovery files remain at')
    const fs = await import('node:fs/promises')
    expect(await fs.readdir(target.config.skillsRoot)).toEqual([])
    const recoveryRoot = join(target.config.dshHome, '.manturhub-recovery')
    const [recoveryId] = await fs.readdir(recoveryRoot)
    await expect(fs.readFile(join(recoveryRoot, recoveryId ?? 'missing', 'story-director', 'SKILL.md'), 'utf8'))
      .resolves.toContain('name: story-director')
  })
})
