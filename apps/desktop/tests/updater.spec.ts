/** User-consent and scheduling behavior for desktop updates. */

import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startAutoUpdates, type DesktopUpdater } from '../src/updater.ts'

class FakeUpdater extends EventEmitter implements DesktopUpdater {
  autoDownload = true
  autoInstallOnAppQuit = true
  allowPrerelease = false
  checkForUpdates = vi.fn(async () => null)
  downloadUpdate = vi.fn(async () => [])
  quitAndInstall = vi.fn()
}

afterEach(() => {
  vi.useRealTimers()
})

describe('desktop automatic updates', () => {
  it('checks on schedule and never downloads without approval', async () => {
    vi.useFakeTimers()
    const updater = new FakeUpdater()
    const confirmDownload = vi.fn(async () => false)
    const stop = startAutoUpdates({
      updater,
      prompts: { confirmDownload, confirmInstall: vi.fn(async () => false) },
      beforeInstall: vi.fn(async () => {}),
      log: vi.fn(),
      checkDelayMs: 10,
      checkIntervalMs: 100,
    })

    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)
    expect(updater.allowPrerelease).toBe(true)
    await vi.advanceTimersByTimeAsync(10)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    updater.emit('update-available', { version: '1.2.3' })
    await vi.waitFor(() => { expect(confirmDownload).toHaveBeenCalledWith('1.2.3') })
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    stop()
    await vi.advanceTimersByTimeAsync(100)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('downloads and installs only after separate confirmations', async () => {
    vi.useFakeTimers()
    const updater = new FakeUpdater()
    let releaseInstall: (() => void) | undefined
    const installReady = new Promise<void>((resolve) => { releaseInstall = resolve })
    const beforeInstall = vi.fn(async () => { await installReady })
    const stop = startAutoUpdates({
      updater,
      prompts: {
        confirmDownload: vi.fn(async () => true),
        confirmInstall: vi.fn(async () => true),
      },
      beforeInstall,
      log: vi.fn(),
    })

    updater.emit('update-available', { version: '1.2.3' })
    await vi.waitFor(() => { expect(updater.downloadUpdate).toHaveBeenCalledTimes(1) })
    updater.emit('update-downloaded', { version: '1.2.3' })
    await vi.waitFor(() => { expect(beforeInstall).toHaveBeenCalledOnce() })
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
    releaseInstall?.()
    await vi.waitFor(() => { expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true) })
    expect(beforeInstall).toHaveBeenCalledOnce()
    stop()
  })

  it('suppresses pending prompt work after disposal', async () => {
    const updater = new FakeUpdater()
    let releaseDownload: ((confirmed: boolean) => void) | undefined
    let releaseInstall: ((confirmed: boolean) => void) | undefined
    const confirmDownload = vi.fn(() => new Promise<boolean>((resolve) => { releaseDownload = resolve }))
    const confirmInstall = vi.fn(() => new Promise<boolean>((resolve) => { releaseInstall = resolve }))
    const beforeInstall = vi.fn(async () => {})
    const stop = startAutoUpdates({
      updater,
      prompts: { confirmDownload, confirmInstall },
      beforeInstall,
      log: vi.fn(),
    })

    updater.emit('update-available', { version: '1.2.3' })
    updater.emit('update-downloaded', { version: '1.2.3' })
    await vi.waitFor(() => {
      expect(confirmDownload).toHaveBeenCalledOnce()
      expect(confirmInstall).toHaveBeenCalledOnce()
    })
    stop()
    releaseDownload?.(true)
    releaseInstall?.(true)
    await Promise.resolve()

    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    expect(beforeInstall).not.toHaveBeenCalled()
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
  })
})
