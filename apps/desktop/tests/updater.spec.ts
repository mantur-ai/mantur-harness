/** User-consent, channel, state, and scheduling behavior for desktop updates. */

import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  allowsPrerelease,
  startAutoUpdates,
  type DesktopUpdateState,
  type DesktopUpdater,
  type StartAutoUpdatesOptions,
} from '../src/updater.ts'

class FakeUpdater extends EventEmitter implements DesktopUpdater {
  autoDownload = true
  autoInstallOnAppQuit = true
  allowPrerelease = false
  checkForUpdates = vi.fn(async () => null)
  downloadUpdate = vi.fn(async () => [])
  quitAndInstall = vi.fn()
}

function start(updater: FakeUpdater, overrides: Partial<StartAutoUpdatesOptions> = {}) {
  const states: DesktopUpdateState[] = []
  const controller = startAutoUpdates({
    updater,
    currentVersion: '1.0.0',
    prompts: {
      confirmDownload: vi.fn(async () => false),
      confirmInstall: vi.fn(async () => false),
    },
    beforeInstall: vi.fn(async () => {}),
    onStateChange: (state) => { states.push(state) },
    log: vi.fn(),
    ...overrides,
  })
  return { controller, states }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('desktop update channels', () => {
  it.each([
    ['1.2.3', false],
    ['1.2.3-alpha.4', true],
    ['1.2.3-beta.2', true],
    ['1.2.3-rc.1', true],
    ['1.2.3-preview.1', false],
  ])('selects prerelease participation for %s', (version, expected) => {
    expect(allowsPrerelease(version)).toBe(expected)
    const updater = new FakeUpdater()
    const { controller } = start(updater, { currentVersion: version })
    expect(updater.allowPrerelease).toBe(expected)
    controller.dispose()
  })
})

describe('desktop updates', () => {
  it('checks on schedule and never downloads without approval', async () => {
    vi.useFakeTimers()
    const updater = new FakeUpdater()
    const confirmDownload = vi.fn(async () => false)
    const { controller, states } = start(updater, {
      prompts: { confirmDownload, confirmInstall: vi.fn(async () => false) },
      checkDelayMs: 10,
      checkIntervalMs: 100,
    })

    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)
    await vi.advanceTimersByTimeAsync(10)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    expect(states.at(-1)).toEqual({ kind: 'checking' })
    updater.emit('update-available', { version: '1.2.3' })
    await vi.waitFor(() => { expect(confirmDownload).toHaveBeenCalledWith('1.2.3') })
    expect(states.at(-1)).toEqual({ kind: 'available', version: '1.2.3', prompting: false })
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    controller.dispose()
    await vi.advanceTimersByTimeAsync(100)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('distinguishes manual no-update and failure states', async () => {
    const updater = new FakeUpdater()
    const { controller, states } = start(updater)

    controller.checkNow()
    expect(updater.checkForUpdates).toHaveBeenCalledOnce()
    updater.emit('update-not-available', { version: '1.0.0' })
    expect(states.at(-1)).toEqual({ kind: 'up-to-date', requestedByUser: true })

    updater.checkForUpdates.mockRejectedValueOnce(new Error('feed unavailable'))
    controller.checkNow()
    await vi.waitFor(() => {
      expect(states.at(-1)).toEqual({ kind: 'error', detail: 'feed unavailable', requestedByUser: true })
    })
    controller.dispose()
  })

  it('publishes download progress and installs only after separate confirmations', async () => {
    vi.useFakeTimers()
    const updater = new FakeUpdater()
    let releaseInstall: (() => void) | undefined
    const installReady = new Promise<void>((resolve) => { releaseInstall = resolve })
    const beforeInstall = vi.fn(async () => { await installReady })
    const { controller, states } = start(updater, {
      prompts: {
        confirmDownload: vi.fn(async () => true),
        confirmInstall: vi.fn(async () => true),
      },
      beforeInstall,
    })

    updater.emit('update-available', { version: '1.2.3' })
    await vi.waitFor(() => { expect(updater.downloadUpdate).toHaveBeenCalledTimes(1) })
    updater.emit('download-progress', { percent: 42.9 })
    expect(states.at(-1)).toEqual({ kind: 'downloading', version: '1.2.3', percent: 42 })
    updater.emit('update-downloaded', { version: '1.2.3' })
    await vi.waitFor(() => { expect(beforeInstall).toHaveBeenCalledOnce() })
    expect(states.at(-1)).toEqual({ kind: 'ready', version: '1.2.3', prompting: true })
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
    releaseInstall?.()
    await vi.waitFor(() => { expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true) })
    controller.dispose()
  })

  it('offers a downloaded version again after the first install prompt is declined', async () => {
    const updater = new FakeUpdater()
    const confirmInstall = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    const { controller, states } = start(updater, {
      prompts: { confirmDownload: vi.fn(async () => true), confirmInstall },
    })

    updater.emit('update-downloaded', { version: '1.2.3' })
    await vi.waitFor(() => {
      expect(states.at(-1)).toEqual({ kind: 'ready', version: '1.2.3', prompting: false })
    })
    controller.installReadyUpdate()
    await vi.waitFor(() => { expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true) })
    expect(confirmInstall).toHaveBeenCalledTimes(2)
    controller.dispose()
  })

  it('handles one downloaded version only once while confirmation and shutdown are pending', async () => {
    const updater = new FakeUpdater()
    let confirmInstall: ((confirmed: boolean) => void) | undefined
    let finishShutdown: (() => void) | undefined
    const confirmation = new Promise<boolean>((resolve) => { confirmInstall = resolve })
    const shutdown = new Promise<void>((resolve) => { finishShutdown = resolve })
    const confirmInstallPrompt = vi.fn(() => confirmation)
    const beforeInstall = vi.fn(() => shutdown)
    const { controller } = start(updater, {
      prompts: { confirmDownload: vi.fn(async () => true), confirmInstall: confirmInstallPrompt },
      beforeInstall,
    })

    updater.emit('update-downloaded', { version: '1.2.3' })
    updater.emit('update-downloaded', { version: '1.2.3' })
    await vi.waitFor(() => { expect(confirmInstallPrompt).toHaveBeenCalledOnce() })

    confirmInstall?.(true)
    await vi.waitFor(() => { expect(beforeInstall).toHaveBeenCalledOnce() })
    updater.emit('update-downloaded', { version: '1.2.3' })
    finishShutdown?.()
    await vi.waitFor(() => { expect(updater.quitAndInstall).toHaveBeenCalledOnce() })

    expect(confirmInstallPrompt).toHaveBeenCalledOnce()
    expect(beforeInstall).toHaveBeenCalledOnce()
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true)
    controller.dispose()
  })

  it('suppresses pending prompt work after disposal', async () => {
    const updater = new FakeUpdater()
    let releaseDownload: ((confirmed: boolean) => void) | undefined
    let releaseInstall: ((confirmed: boolean) => void) | undefined
    const confirmDownload = vi.fn(() => new Promise<boolean>((resolve) => { releaseDownload = resolve }))
    const confirmInstall = vi.fn(() => new Promise<boolean>((resolve) => { releaseInstall = resolve }))
    const beforeInstall = vi.fn(async () => {})
    const { controller } = start(updater, {
      prompts: { confirmDownload, confirmInstall },
      beforeInstall,
    })

    updater.emit('update-available', { version: '1.2.3' })
    updater.emit('update-downloaded', { version: '1.2.3' })
    await vi.waitFor(() => {
      expect(confirmDownload).toHaveBeenCalledOnce()
      expect(confirmInstall).toHaveBeenCalledOnce()
    })
    controller.dispose()
    releaseDownload?.(true)
    releaseInstall?.(true)
    await Promise.resolve()

    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    expect(beforeInstall).not.toHaveBeenCalled()
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
  })
})
