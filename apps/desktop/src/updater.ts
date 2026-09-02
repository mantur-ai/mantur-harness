/** User-controlled automatic update checks for installed desktop builds. */

import type { UpdateDownloadedEvent, UpdateInfo } from 'electron-updater'

export const UPDATE_CHECK_DELAY_MS = 15_000
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000

/** The electron-updater operations used by the desktop controller. */
export interface DesktopUpdater {
  /** Whether an available version downloads without application approval. */
  autoDownload: boolean
  /** Whether a downloaded version installs during an unrelated application quit. */
  autoInstallOnAppQuit: boolean
  /** Whether prerelease versions participate in update selection. */
  allowPrerelease: boolean
  /** Check the configured release feed once. */
  checkForUpdates: () => Promise<unknown>
  /** Download the version most recently reported as available. */
  downloadUpdate: () => Promise<unknown>
  /** Quit the application and run the downloaded installer. */
  quitAndInstall: (isSilent?: boolean, isForceRunAfter?: boolean) => void
  /** Register one updater lifecycle listener. */
  on: {
    (event: 'update-available', listener: (info: UpdateInfo) => void): void
    (event: 'update-downloaded', listener: (info: UpdateDownloadedEvent) => void): void
    (event: 'error', listener: (error: Error) => void): void
  }
  /** Remove one updater lifecycle listener. */
  off: {
    (event: 'update-available', listener: (info: UpdateInfo) => void): void
    (event: 'update-downloaded', listener: (info: UpdateDownloadedEvent) => void): void
    (event: 'error', listener: (error: Error) => void): void
  }
}

/** Prompts owned by the native desktop update flow. */
export interface UpdatePrompts {
  /** Ask before downloading an available version. */
  confirmDownload: (version: string) => Promise<boolean>
  /** Ask before stopping Harness and installing a downloaded version. */
  confirmInstall: (version: string) => Promise<boolean>
}

/** Dependencies and lifecycle callbacks for one updater controller. */
export interface StartAutoUpdatesOptions {
  updater: DesktopUpdater
  prompts: UpdatePrompts
  beforeInstall: () => Promise<void>
  log: (message: string) => void
  checkDelayMs?: number
  checkIntervalMs?: number
}

/**
 * Start delayed and periodic update checks.
 * @returns a disposer that clears timers and removes every updater listener.
 */
export function startAutoUpdates(options: StartAutoUpdatesOptions): () => void {
  const { updater } = options
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = false
  updater.allowPrerelease = true
  let active = true
  let downloading = false
  const isActive = (): boolean => active

  const onAvailable = (info: UpdateInfo): void => {
    if (downloading) return
    void options.prompts.confirmDownload(info.version).then(async (confirmed) => {
      if (!active || !confirmed || downloading) return
      downloading = true
      options.log(`desktop update: downloading ${info.version}`)
      try {
        await updater.downloadUpdate()
      } catch (error) {
        downloading = false
        if (isActive()) options.log(`desktop update: download failed: ${String(error)}`)
      }
    }).catch((error: unknown) => {
      if (active) options.log(`desktop update: download prompt failed: ${String(error)}`)
    })
  }

  const onDownloaded = (info: UpdateDownloadedEvent): void => {
    void options.prompts.confirmInstall(info.version).then(async (confirmed) => {
      if (!active || !confirmed) return
      await options.beforeInstall()
      if (!isActive()) return
      updater.quitAndInstall(false, true)
    }).catch((error: unknown) => {
      if (active) options.log(`desktop update: install prompt failed: ${String(error)}`)
    })
  }

  const onError = (error: Error): void => {
    options.log(`desktop update: ${error.message}`)
  }

  updater.on('update-available', onAvailable)
  updater.on('update-downloaded', onDownloaded)
  updater.on('error', onError)

  const check = (): void => {
    options.log('desktop update: checking')
    void updater.checkForUpdates().catch((error: unknown) => {
      if (active) options.log(`desktop update: check failed: ${String(error)}`)
    })
  }
  const delay = setTimeout(check, options.checkDelayMs ?? UPDATE_CHECK_DELAY_MS)
  const interval = setInterval(check, options.checkIntervalMs ?? UPDATE_CHECK_INTERVAL_MS)

  return () => {
    active = false
    clearTimeout(delay)
    clearInterval(interval)
    updater.off('update-available', onAvailable)
    updater.off('update-downloaded', onDownloaded)
    updater.off('error', onError)
  }
}
