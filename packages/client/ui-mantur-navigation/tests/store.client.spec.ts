// @vitest-environment jsdom

import type { Context } from '@deepseek-ai/cordis'
import type { ManturLoginAttemptId } from '@deepseek-ai/dsh-authorization-manturhub/types'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManturMarketplaceStore } from '../src/client/store.ts'

const listed = {
  slug: 'story-director',
  name: '故事导演',
  description: '把故事变成分镜',
  category: '剧本创作',
  version: '1.2.3',
  triggers: ['写分镜'],
  installed: false,
}

afterEach(() => {
  vi.useRealTimers()
})

function subject(remote: object): ManturMarketplaceStore {
  return new ManturMarketplaceStore({ remote } as Context)
}

describe('Mantur marketplace store', () => {
  it('loads, refreshes, and reports catalog failures', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ ok: true, value: { skills: [listed], installedCount: 0, signedIn: false } })
      .mockResolvedValueOnce({ ok: false, error: { code: 'gateway/internal', message: 'offline' } })
    const store = subject({ manturMarketplace: { list } })

    await store.load()
    expect(store.store.getSnapshot()).toMatchObject({ phase: 'ready', catalog: { skills: [listed] } })
    await store.load()
    expect(store.store.getSnapshot()).toEqual({ phase: 'failed' })
  })

  it('ignores stale catalog settlements after disposal', async () => {
    const settlement = Promise.withResolvers<{ ok: true; value: { skills: never[]; installedCount: 0; signedIn: false } }>()
    const store = subject({ manturMarketplace: { list: () => settlement.promise } })

    const operation = store.load()
    store.dispose()
    settlement.resolve({ ok: true, value: { skills: [], installedCount: 0, signedIn: false } })
    await operation

    expect(store.store.getSnapshot()).toEqual({ phase: 'loading' })
  })

  it('ignores stale catalog and detail failures', async () => {
    const list = Promise.withResolvers<{ ok: false; error: { code: string; message: string } }>()
    const detail = Promise.withResolvers<{ ok: false; error: { code: string; message: string } }>()
    const store = subject({
      manturMarketplace: { list: () => list.promise, detail: () => detail.promise },
    })
    const loading = store.load()
    store.dispose()
    list.resolve({ ok: false, error: { code: 'gateway/internal', message: 'failed' } })
    await loading
    store.store.set({ phase: 'ready', catalog: { skills: [listed], installedCount: 0, signedIn: true } })
    const opening = store.openDetail(listed.slug)
    store.closeDetail()
    detail.resolve({ ok: false, error: { code: 'gateway/internal', message: 'failed' } })
    await opening
    expect(store.store.getSnapshot()).not.toHaveProperty('detail')
  })

  it('opens, closes, and recovers from Skill detail reads', async () => {
    const detail = vi.fn()
      .mockResolvedValueOnce({ ok: true, value: { ...listed, usesOperators: [] } })
      .mockResolvedValueOnce({ ok: false, error: { code: 'gateway/internal', message: 'offline' } })
    const store = subject({ manturMarketplace: { detail } })
    await store.openDetail(listed.slug)
    store.store.set({ phase: 'ready', catalog: { skills: [listed], installedCount: 0, signedIn: false } })

    await store.openDetail(listed.slug)
    expect(store.store.getSnapshot()).toMatchObject({ detail: { slug: listed.slug } })
    store.closeDetail()
    expect(store.store.getSnapshot()).not.toHaveProperty('detail')
    await store.openDetail(listed.slug)
    expect(store.store.getSnapshot()).toMatchObject({ detailError: listed.slug })
    store.store.set({ phase: 'failed' })
    store.closeDetail()
    expect(store.store.getSnapshot()).toEqual({ phase: 'failed' })
  })

  it('publishes installing and installed states around a Host-confirmed install', async () => {
    const settlement = Promise.withResolvers<{
      ok: true
      value: { slug: string; version: string; installed: true }
    }>()
    const store = subject({ manturMarketplace: { installSkill: () => settlement.promise } })
    store.store.set({
      phase: 'ready',
      catalog: { skills: [listed], installedCount: 0, signedIn: true },
      detail: { ...listed, usesOperators: [] },
    })

    const operation = store.install(listed.slug)
    expect(store.store.getSnapshot()).toMatchObject({ phase: 'ready', installing: listed.slug })
    settlement.resolve({ ok: true, value: { slug: listed.slug, version: listed.version, installed: true } })
    await operation

    expect(store.store.getSnapshot()).toMatchObject({
      phase: 'ready',
      installing: undefined,
      installError: undefined,
      catalog: { installedCount: 1, skills: [{ installed: true }] },
      detail: { installed: true },
    })
  })

  it('keeps local conflicts distinct from generic installation failures', async () => {
    const store = subject({
      manturMarketplace: {
        installSkill: () => Promise.resolve({
          ok: false as const,
          error: new RemoteError(
            'mantur-marketplace/local-conflict',
            'modified',
            { slug: listed.slug },
          ),
        }),
      },
    })
    store.store.set({
      phase: 'ready',
      catalog: { skills: [listed], installedCount: 0, signedIn: true },
    })

    await store.install(listed.slug)

    expect(store.store.getSnapshot()).toMatchObject({
      phase: 'ready', installError: 'local-conflict', catalog: { installedCount: 0 },
    })
  })

  it('marks the catalog signed out when the Host reports expired authorization', async () => {
    const store = subject({
      manturMarketplace: {
        installSkill: () => Promise.resolve({
          ok: false as const,
          error: { code: 'mantur-marketplace/auth-required', message: 'expired' },
        }),
      },
    })
    store.store.set({ phase: 'ready', catalog: { skills: [listed], installedCount: 0, signedIn: true } })

    await store.install(listed.slug)

    expect(store.store.getSnapshot()).toMatchObject({
      installError: 'auth-required',
      catalog: { signedIn: false },
    })
  })

  it('maps generic installation failures', async () => {
    const store = subject({
      manturMarketplace: {
        installSkill: () => Promise.resolve({
          ok: false as const,
          error: { code: 'gateway/internal', message: 'failed' },
        }),
      },
    })
    store.store.set({ phase: 'ready', catalog: { skills: [listed], installedCount: 0, signedIn: true } })

    await store.install(listed.slug)

    expect(store.store.getSnapshot()).toMatchObject({ installError: 'failed', catalog: { signedIn: true } })
  })

  it('requires sign-in and ignores duplicate or inapplicable installation requests', async () => {
    const install = vi.fn()
    const store = subject({ manturMarketplace: { installSkill: install } })
    await store.install(listed.slug)
    store.store.set({ phase: 'ready', catalog: { skills: [listed], installedCount: 0, signedIn: false } })
    await store.install(listed.slug)
    expect(store.store.getSnapshot()).toMatchObject({ installError: 'auth-required' })
    store.store.set({ phase: 'ready', catalog: { skills: [listed], installedCount: 0, signedIn: true }, installing: listed.slug })
    await store.install(listed.slug)
    expect(install).not.toHaveBeenCalled()
  })

  it('does not double-count an already installed or absent catalog entry', async () => {
    const install = () => Promise.resolve({
      ok: true as const,
      value: { slug: listed.slug, version: listed.version, installed: true as const },
    })
    const store = subject({ manturMarketplace: { installSkill: install } })
    store.store.set({
      phase: 'ready',
      catalog: {
        skills: [{ ...listed, installed: true }, { ...listed, slug: 'other' }],
        installedCount: 1,
        signedIn: true,
      },
      detail: { ...listed, slug: 'other', usesOperators: [] },
    })
    await store.install(listed.slug)
    expect(store.store.getSnapshot()).toMatchObject({ catalog: { installedCount: 1 }, detail: { slug: 'other' } })

    store.store.set({ phase: 'ready', catalog: { skills: [], installedCount: 0, signedIn: true } })
    await store.install(listed.slug)
    expect(store.store.getSnapshot()).toMatchObject({ catalog: { installedCount: 0 } })
  })

  it('ignores an installation result after its pending state changes', async () => {
    const settlement = Promise.withResolvers<{
      ok: true
      value: { slug: string; version: string; installed: true }
    }>()
    const store = subject({ manturMarketplace: { installSkill: () => settlement.promise } })
    store.store.set({ phase: 'ready', catalog: { skills: [listed], installedCount: 0, signedIn: true } })
    const operation = store.install(listed.slug)
    store.store.set({ phase: 'failed' })
    settlement.resolve({ ok: true, value: { slug: listed.slug, version: listed.version, installed: true } })
    await operation
    expect(store.store.getSnapshot()).toEqual({ phase: 'failed' })
  })

  it('completes the device gate and enables installation without storing a credential', async () => {
    vi.useFakeTimers()
    const attemptId = 'attempt-1' as ManturLoginAttemptId
    const progress = vi.fn()
      .mockResolvedValueOnce({ ok: true, value: { status: 'pending' } })
      .mockResolvedValueOnce({
        ok: true,
        value: { status: 'authorized', account: { email: 'artist@example.com' } },
      })
    const store = subject({
      manturAccount: {
        startLogin: () => Promise.resolve({
          ok: true as const,
          value: {
            attemptId,
            verificationUrl: 'https://hub.mantur.ai/device',
            userCode: 'MANT-1234',
            expiresAt: Date.now() + 60_000,
          },
        }),
        loginProgress: progress,
      },
    })
    store.store.set({
      phase: 'ready',
      catalog: { skills: [listed], installedCount: 0, signedIn: false },
    })

    await store.startLogin()
    expect(store.store.getSnapshot()).toMatchObject({
      phase: 'ready', loginPhase: 'authorizing', login: { userCode: 'MANT-1234' },
    })
    await vi.advanceTimersByTimeAsync(750)
    expect(progress).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(750)
    expect(store.store.getSnapshot()).toMatchObject({
      phase: 'ready', catalog: { signedIn: true }, login: undefined, loginPhase: undefined,
    })
  })

  it('reports login start, polling, and cancellation failures', async () => {
    vi.useFakeTimers()
    const attemptId = 'attempt-2' as ManturLoginAttemptId
    const startLogin = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: { code: 'gateway/internal', message: 'failed' } })
      .mockResolvedValue({
        ok: true,
        value: { attemptId, verificationUrl: 'https://hub.mantur.ai/device', userCode: 'CODE', expiresAt: Date.now() + 60_000 },
      })
    const loginProgress = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: { code: 'gateway/internal', message: 'failed' } })
      .mockResolvedValueOnce({ ok: true, value: { status: 'cancelled' } })
      .mockResolvedValueOnce({ ok: true, value: { status: 'expired' } })
    const cancelLogin = vi.fn().mockResolvedValue({ ok: false, error: { code: 'gateway/internal', message: 'failed' } })
    const store = subject({ manturAccount: { startLogin, loginProgress, cancelLogin } })
    const ready = { phase: 'ready' as const, catalog: { skills: [listed], installedCount: 0, signedIn: false } }
    store.store.set(ready)

    await store.startLogin()
    expect(store.store.getSnapshot()).toMatchObject({ loginPhase: 'failed' })
    await store.startLogin()
    await store.startLogin()
    await vi.advanceTimersByTimeAsync(750)
    expect(store.store.getSnapshot()).toMatchObject({ loginPhase: 'failed' })

    store.store.set(ready)
    await store.startLogin()
    await vi.advanceTimersByTimeAsync(750)
    expect(store.store.getSnapshot()).toMatchObject({ login: undefined, loginPhase: undefined })

    store.store.set(ready)
    await store.startLogin()
    await vi.advanceTimersByTimeAsync(750)
    expect(store.store.getSnapshot()).toMatchObject({ loginPhase: 'failed' })

    store.store.set({ ...ready, login: { attemptId, verificationUrl: 'https://hub.mantur.ai/device', userCode: 'CODE', expiresAt: 0 }, loginPhase: 'authorizing' })
    await store.cancelLogin()
    expect(store.store.getSnapshot()).toMatchObject({ loginPhase: 'failed' })
  })

  it('cancels a device attempt and ignores cancellation outside an active ready attempt', async () => {
    vi.useFakeTimers()
    const attemptId = 'attempt-3' as ManturLoginAttemptId
    const cancelLogin = vi.fn().mockResolvedValue({ ok: true, value: undefined })
    const store = subject({ manturAccount: { cancelLogin } })
    await store.cancelLogin()
    store.store.set({ phase: 'ready', catalog: { skills: [], installedCount: 0, signedIn: false } })
    await store.cancelLogin()
    store.store.set({
      phase: 'ready', catalog: { skills: [], installedCount: 0, signedIn: false },
      login: { attemptId, verificationUrl: 'https://hub.mantur.ai/device', userCode: 'CODE', expiresAt: 0 },
      loginPhase: 'authorizing',
    })
    await store.cancelLogin()
    expect(cancelLogin).toHaveBeenCalledWith(attemptId)
    expect(store.store.getSnapshot()).toMatchObject({ login: undefined, loginPhase: undefined })
    store.dispose()
  })

  it('ignores stale login start, cancellation, and polling settlements', async () => {
    vi.useFakeTimers()
    const attemptId = 'attempt-stale' as ManturLoginAttemptId
    const start = Promise.withResolvers<{ ok: false; error: { code: string; message: string } }>()
    const cancel = Promise.withResolvers<{ ok: true; value: undefined }>()
    const progress = Promise.withResolvers<{ ok: true; value: { status: 'pending' } }>()
    const store = subject({
      manturAccount: {
        startLogin: () => start.promise,
        cancelLogin: () => cancel.promise,
        loginProgress: () => progress.promise,
      },
    })
    const ready = { phase: 'ready' as const, catalog: { skills: [], installedCount: 0, signedIn: false } }
    store.store.set(ready)
    const starting = store.startLogin()
    store.dispose()
    start.resolve({ ok: false, error: { code: 'gateway/internal', message: 'failed' } })
    await starting

    store.store.set({
      ...ready,
      login: { attemptId, verificationUrl: 'https://hub.mantur.ai/device', userCode: 'CODE', expiresAt: 0 },
    })
    const cancelling = store.cancelLogin()
    store.store.set({ phase: 'failed' })
    cancel.resolve({ ok: true, value: undefined })
    await cancelling

    store.store.set(ready)
    const successfulStart = store.startLogin()
    start.resolve({ ok: false, error: { code: 'gateway/internal', message: 'failed' } })
    await successfulStart
    store.store.set({
      ...ready,
      login: { attemptId, verificationUrl: 'https://hub.mantur.ai/device', userCode: 'CODE', expiresAt: 0 },
      loginPhase: 'authorizing',
    })
    ;(store as unknown as { scheduleLoginPoll: (id: ManturLoginAttemptId, generation: number) => void })
      .scheduleLoginPoll(attemptId, 0)
    await vi.advanceTimersByTimeAsync(750)
    store.dispose()
    progress.resolve({ ok: true, value: { status: 'pending' } })
    await vi.runAllTimersAsync()
    expect(store.store.getSnapshot()).toMatchObject({ phase: 'ready' })
  })
})
