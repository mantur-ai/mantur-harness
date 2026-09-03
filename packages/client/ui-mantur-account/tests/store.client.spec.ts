// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ManturLoginStart } from '@deepseek-ai/dsh-authorization-manturhub/types'
import { ManturAccountStore } from '../src/client/store.ts'

const login: ManturLoginStart = {
  attemptId: 'attempt-1' as ManturLoginStart['attemptId'],
  verificationUrl: 'https://hub.mantur.ai/device',
  userCode: 'MANT-1234',
  expiresAt: 10_000,
}

const production = { environment: 'production' as const, baseUrl: 'https://hub.mantur.ai' }
const signedOut = { ...production, status: 'signed-out' as const }

const success = <T>(value: T) => Promise.resolve({ ok: true as const, value })
const failure = () => Promise.resolve({
  ok: false as const,
  error: { code: 'gateway/internal', message: 'remote failed' },
})

function harness() {
  const reload = vi.fn()
  const remote = {
    status: vi.fn(),
    setEnvironment: vi.fn(),
    startLogin: vi.fn(),
    loginProgress: vi.fn(),
    cancelLogin: vi.fn(),
    signOut: vi.fn(),
  }
  const controller = new ManturAccountStore({ remote: { manturAccount: remote } } as never, reload)
  return { controller, reload, remote }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ManturAccountStore', () => {
  it('loads signed-out, signed-in, and failed account states', async () => {
    const subject = harness()
    subject.remote.status
      .mockReturnValueOnce(success(signedOut))
      .mockReturnValueOnce(success({ ...production, status: 'signed-in', account: { email: 'artist@example.com' } }))
      .mockReturnValueOnce(failure())

    await subject.controller.load()
    expect(subject.controller.store.getSnapshot()).toEqual({ phase: 'signed-out', environment: production })
    await subject.controller.load()
    expect(subject.controller.store.getSnapshot()).toEqual({
      phase: 'signed-in', account: { email: 'artist@example.com' }, environment: production,
    })
    await subject.controller.load()
    expect(subject.controller.store.getSnapshot()).toEqual({ phase: 'failed', environment: production })
  })

  it('does not let stale load success or failure replace a newer state', async () => {
    const subject = harness()
    const staleSuccess = Promise.withResolvers<Awaited<ReturnType<typeof success>>>()
    subject.remote.status
      .mockReturnValueOnce(staleSuccess.promise)
      .mockReturnValueOnce(success(signedOut))
    const first = subject.controller.load()
    await subject.controller.load()
    staleSuccess.resolve(await success({ ...production, status: 'signed-in', account: { email: 'old@example.com' } }))
    await first
    expect(subject.controller.store.getSnapshot()).toEqual({ phase: 'signed-out', environment: production })

    const staleFailure = Promise.withResolvers<Awaited<ReturnType<typeof failure>>>()
    subject.remote.status
      .mockReturnValueOnce(staleFailure.promise)
      .mockReturnValueOnce(success(signedOut))
    const third = subject.controller.load()
    await subject.controller.load()
    staleFailure.resolve(await failure())
    await third
    expect(subject.controller.store.getSnapshot()).toEqual({ phase: 'signed-out', environment: production })
  })

  it('polls pending login progress until authorization succeeds', async () => {
    vi.useFakeTimers()
    const subject = harness()
    subject.remote.startLogin.mockReturnValue(success(login))
    subject.remote.loginProgress
      .mockReturnValueOnce(success({ status: 'pending' }))
      .mockReturnValueOnce(success({ status: 'authorized', account: { email: 'artist@example.com' } }))

    await subject.controller.start()
    expect(subject.controller.store.getSnapshot()).toEqual({ phase: 'authorizing', login })
    await vi.advanceTimersByTimeAsync(750)
    expect(subject.controller.store.getSnapshot()).toEqual({ phase: 'authorizing', login })
    await vi.advanceTimersByTimeAsync(750)
    expect(subject.controller.store.getSnapshot()).toEqual({
      phase: 'signed-in', account: { email: 'artist@example.com' },
    })
  })

  it('reports start failure and ignores a stale start result', async () => {
    const failed = harness()
    failed.remote.startLogin.mockReturnValue(failure())
    await failed.controller.start()
    expect(failed.controller.store.getSnapshot()).toEqual({ phase: 'failed' })

    const stale = harness()
    const deferred = Promise.withResolvers<Awaited<ReturnType<typeof success<ManturLoginStart>>>>()
    stale.remote.startLogin.mockReturnValue(deferred.promise)
    stale.remote.status.mockReturnValue(success(signedOut))
    const starting = stale.controller.start()
    await stale.controller.load()
    deferred.resolve(await success(login))
    await starting
    expect(stale.controller.store.getSnapshot()).toEqual({ phase: 'signed-out', environment: production })

    const staleFailure = Promise.withResolvers<Awaited<ReturnType<typeof failure>>>()
    stale.remote.startLogin.mockReturnValueOnce(staleFailure.promise)
    const startingFailure = stale.controller.start()
    await stale.controller.load()
    staleFailure.resolve(await failure())
    await startingFailure
    expect(stale.controller.store.getSnapshot()).toEqual({ phase: 'signed-out', environment: production })
  })

  it.each([
    [{ status: 'cancelled' }, { phase: 'signed-out' }],
    [{ status: 'failed' }, { phase: 'failed' }],
  ] as const)('projects terminal login progress %#', async (progress, expected) => {
    vi.useFakeTimers()
    const subject = harness()
    subject.remote.startLogin.mockReturnValue(success(login))
    subject.remote.loginProgress.mockReturnValue(success(progress))
    await subject.controller.start()

    await vi.advanceTimersByTimeAsync(750)

    expect(subject.controller.store.getSnapshot()).toEqual(expected)
  })

  it('reports polling failure and ignores stale polling success and failure', async () => {
    vi.useFakeTimers()
    const failed = harness()
    failed.remote.startLogin.mockReturnValue(success(login))
    failed.remote.loginProgress.mockReturnValue(failure())
    await failed.controller.start()
    await vi.advanceTimersByTimeAsync(750)
    expect(failed.controller.store.getSnapshot()).toEqual({ phase: 'failed' })

    for (const progress of [
      success({ status: 'authorized', account: { email: 'old@example.com' } }),
      failure(),
    ]) {
      const stale = harness()
      const deferred = Promise.withResolvers<Awaited<typeof progress>>()
      stale.remote.startLogin.mockReturnValue(success(login))
      stale.remote.loginProgress.mockReturnValue(deferred.promise)
      stale.remote.status.mockReturnValue(success(signedOut))
      await stale.controller.start()
      await vi.advanceTimersByTimeAsync(750)
      await stale.controller.load()
      deferred.resolve(await progress)
      await Promise.resolve()
      expect(stale.controller.store.getSnapshot()).toEqual({ phase: 'signed-out', environment: production })
    }
  })

  it('handles cancel without an attempt, successful cancel, and failed cancel', async () => {
    const subject = harness()
    await subject.controller.cancel()
    expect(subject.remote.cancelLogin).not.toHaveBeenCalled()

    subject.remote.startLogin.mockReturnValue(success(login))
    subject.remote.cancelLogin.mockReturnValueOnce(success(undefined)).mockReturnValueOnce(failure())
    await subject.controller.start()
    await subject.controller.cancel()
    expect(subject.controller.store.getSnapshot()).toEqual({ phase: 'signed-out' })
    await subject.controller.start()
    await subject.controller.cancel()
    expect(subject.controller.store.getSnapshot()).toEqual({ phase: 'failed' })
  })

  it('handles successful, failed, and stale sign-out settlements', async () => {
    const subject = harness()
    subject.remote.signOut.mockReturnValueOnce(success(undefined)).mockReturnValueOnce(failure())
    await subject.controller.signOut()
    expect(subject.controller.store.getSnapshot()).toEqual({ phase: 'signed-out' })
    await subject.controller.signOut()
    expect(subject.controller.store.getSnapshot()).toEqual({ phase: 'failed' })

    const deferred = Promise.withResolvers<Awaited<ReturnType<typeof success<undefined>>>>()
    subject.remote.signOut.mockReturnValueOnce(deferred.promise)
    subject.remote.status.mockReturnValue(success(signedOut))
    const signingOut = subject.controller.signOut()
    await subject.controller.load()
    deferred.resolve(await success(undefined))
    await signingOut
    expect(subject.controller.store.getSnapshot()).toEqual({ phase: 'signed-out', environment: production })

    const staleFailure = Promise.withResolvers<Awaited<ReturnType<typeof failure>>>()
    subject.remote.signOut.mockReturnValueOnce(staleFailure.promise)
    const failedSignOut = subject.controller.signOut()
    await subject.controller.load()
    staleFailure.resolve(await failure())
    await failedSignOut
    expect(subject.controller.store.getSnapshot()).toEqual({ phase: 'signed-out', environment: production })
  })

  it('validates, persists, and reloads environment selection', async () => {
    const missing = harness()
    missing.remote.status.mockReturnValue(success({
      ...signedOut, testBaseUrl: 'https://saved-test.mantur.example',
    }))
    await missing.controller.load()
    await missing.controller.setEnvironment('test', '   ')
    expect(missing.remote.setEnvironment).not.toHaveBeenCalled()
    expect(missing.controller.store.getSnapshot()).toEqual({
      phase: 'signed-out',
      environment: { ...production, testBaseUrl: 'https://saved-test.mantur.example' },
      environmentError: 'missing-test-url',
    })

    const switched = harness()
    switched.remote.status.mockReturnValue(success(signedOut))
    switched.remote.setEnvironment.mockReturnValue(success({
      environment: 'test', baseUrl: 'https://test.mantur.example', testBaseUrl: 'https://test.mantur.example',
    }))
    await switched.controller.load()
    await switched.controller.setEnvironment('test', ' https://test.mantur.example ')
    expect(switched.remote.setEnvironment).toHaveBeenCalledWith({
      environment: 'test', testBaseUrl: 'https://test.mantur.example',
    })
    expect(switched.reload).toHaveBeenCalledOnce()

    const failed = harness()
    failed.remote.status.mockReturnValue(success(signedOut))
    failed.remote.setEnvironment.mockReturnValue(failure())
    await failed.controller.load()
    await failed.controller.setEnvironment('production', '')
    expect(failed.reload).not.toHaveBeenCalled()
    expect(failed.controller.store.getSnapshot()).toEqual({
      phase: 'signed-out', environment: production, environmentBusy: false, environmentError: 'failed',
    })
  })

  it('ignores stale environment success and failure settlements', async () => {
    for (const settlement of [success(production), failure()]) {
      const subject = harness()
      subject.remote.status.mockReturnValue(success(signedOut))
      await subject.controller.load()
      const deferred = Promise.withResolvers<Awaited<typeof settlement>>()
      subject.remote.setEnvironment.mockReturnValue(deferred.promise)
      const switching = subject.controller.setEnvironment('production', '')
      await subject.controller.load()
      deferred.resolve(await settlement)
      await switching
      expect(subject.reload).not.toHaveBeenCalled()
      expect(subject.controller.store.getSnapshot()).toEqual({ phase: 'signed-out', environment: production })
    }
  })

  it('uses browser reload when no reload override is supplied', async () => {
    const reload = vi.fn()
    vi.stubGlobal('window', { location: { reload } })
    const remote = {
      status: vi.fn(),
      setEnvironment: vi.fn(() => success(production)),
      startLogin: vi.fn(),
      loginProgress: vi.fn(),
      cancelLogin: vi.fn(),
      signOut: vi.fn(),
    }
    const controller = new ManturAccountStore({ remote: { manturAccount: remote } } as never)

    await controller.setEnvironment('production', '')

    expect(reload).toHaveBeenCalledOnce()
  })

  it('invalidates scheduled polling when disposed', async () => {
    vi.useFakeTimers()
    const subject = harness()
    subject.remote.startLogin.mockReturnValue(success(login))
    await subject.controller.start()
    subject.controller.dispose()
    await vi.advanceTimersByTimeAsync(750)
    expect(subject.remote.loginProgress).not.toHaveBeenCalled()
    subject.controller.dispose()
  })
})
