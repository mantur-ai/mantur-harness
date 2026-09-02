/** Thin native window over the shipped Mantur profile. */

import { appendFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, shell } from 'electron'
import electronUpdater from 'electron-updater'
import {
  canResetProjectionCache,
  desktopPaths,
  desktopUserDataPath,
  prepareDesktopPaths,
  resetProjectionCache,
} from './desktop-state.ts'
import { desktopCopy } from './locales.ts'
import { startDesktopService, type DesktopService } from './runtime.ts'
import { startAutoUpdates } from './updater.ts'

const APP_NAME = '漫途Agent'
const STARTUP_PAGE = fileURLToPath(new URL('../resources/startup.html', import.meta.url))

let mainWindow: BrowserWindow | undefined
let service: DesktopService | undefined
let serviceUrl: string | undefined
let quitting = false
let stopUpdates: (() => void) | undefined

app.setName(APP_NAME)
app.setPath('userData', desktopUserDataPath(
  app.getPath('appData'),
  app.isPackaged ? 'release' : 'development',
))
const paths = desktopPaths(app.getPath('userData'))

function writeDesktopLog(message: string): void {
  void appendFile(paths.logPath, `${new Date().toISOString()} ${message}\n`).catch((error: unknown) => {
    console.error(error)
  })
}

function isQuitting(): boolean {
  return quitting
}

function openExternal(url: string): void {
  if (!/^https?:\/\//u.test(url)) return
  void shell.openExternal(url).catch((error: unknown) => { console.error(error) })
}

function createWindow(target = STARTUP_PAGE): BrowserWindow {
  const window = new BrowserWindow({
    width: 1_280,
    height: 820,
    minWidth: 880,
    minHeight: 600,
    show: false,
    backgroundColor: '#f7f8fa',
    title: APP_NAME,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, target) => {
    if (serviceUrl !== undefined && new URL(target).origin === new URL(serviceUrl).origin) return
    event.preventDefault()
    openExternal(target)
  })
  window.once('ready-to-show', () => { window.show() })
  window.on('closed', () => { mainWindow = undefined })
  if (target === STARTUP_PAGE) void window.loadFile(target)
  else void window.loadURL(target)
  mainWindow = window
  return window
}

async function startupRecovery(error: unknown): Promise<'reset-cache' | 'show-log' | 'quit'> {
  const copy = desktopCopy(app.getLocale())
  const detail = error instanceof Error ? error.message : String(error)
  const resettable = canResetProjectionCache(error)
  const buttons = resettable
    ? [copy.resetCacheButton, copy.showLogButton, copy.quitButton]
    : [copy.showLogButton, copy.quitButton]
  const { response } = await dialog.showMessageBox({
    type: 'error',
    title: copy.startupFailedTitle,
    message: copy.startupFailedMessage,
    detail,
    buttons,
    defaultId: buttons.length - 1,
    cancelId: buttons.length - 1,
    noLink: true,
  })
  if (resettable && response === 0) return 'reset-cache'
  return response === buttons.length - 2 ? 'show-log' : 'quit'
}

async function launch(): Promise<void> {
  const window = createWindow()
  await prepareDesktopPaths(paths)
  while (!quitting) {
    serviceUrl = undefined
    service = startDesktopService({
      electronExecutable: process.execPath,
      cwd: paths.launchRoot,
      environment: { ...process.env, DSH_HOME: paths.dshHome },
      logPath: paths.logPath,
      mirrorOutput: !app.isPackaged,
    })
    service.child.once('exit', (code, signal) => {
      if (quitting || serviceUrl === undefined) return
      void startupRecovery(new Error(
        `dsh stopped while the desktop window was running (code ${String(code)}, signal ${String(signal)}).`,
      )).then((action) => {
        if (action === 'show-log') shell.showItemInFolder(paths.logPath)
        app.quit()
      })
    })
    try {
      serviceUrl = await service.ready
      await window.loadURL(serviceUrl)
      startUpdates()
      return
    } catch (error) {
      if (isQuitting()) return
      const action = await startupRecovery(error)
      if (action === 'reset-cache') {
        await resetProjectionCache(paths.dshHome)
        writeDesktopLog('desktop recovery: reset session projection cache after user approval')
        continue
      }
      if (action === 'show-log') shell.showItemInFolder(paths.logPath)
      app.quit()
      return
    }
  }
}

async function stopService(): Promise<void> {
  const active = service
  if (active === undefined) return
  active.stop()
  await active.closed
  if (service === active) service = undefined
}

function startUpdates(): void {
  if (!app.isPackaged || stopUpdates !== undefined) return
  const copy = desktopCopy(app.getLocale())
  const { autoUpdater } = electronUpdater
  stopUpdates = startAutoUpdates({
    updater: autoUpdater,
    log: writeDesktopLog,
    beforeInstall: async () => {
      quitting = true
      await stopService()
    },
    prompts: {
      confirmDownload: async (version) => {
        const result = await dialog.showMessageBox({
          type: 'info',
          title: copy.updateAvailableTitle,
          message: copy.updateAvailableMessage(version),
          buttons: [copy.downloadButton, copy.laterButton],
          defaultId: 1,
          cancelId: 1,
          noLink: true,
        })
        return result.response === 0
      },
      confirmInstall: async (version) => {
        const result = await dialog.showMessageBox({
          type: 'info',
          title: copy.updateReadyTitle,
          message: copy.updateReadyMessage(version),
          buttons: [copy.restartButton, copy.laterButton],
          defaultId: 1,
          cancelId: 1,
          noLink: true,
        })
        return result.response === 0
      },
    },
  })
}

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized() === true) mainWindow.restore()
    mainWindow?.show()
    mainWindow?.focus()
  })
  void app.whenReady().then(launch).catch((error: unknown) => {
    writeDesktopLog(`desktop startup: ${String(error)}`)
    void startupRecovery(error).then((action) => {
      if (action === 'show-log') shell.showItemInFolder(paths.logPath)
      app.quit()
    })
  })
}

app.on('activate', () => {
  if (mainWindow === undefined && serviceUrl !== undefined) {
    createWindow(serviceUrl)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  quitting = true
  stopUpdates?.()
  stopUpdates = undefined
  if (service === undefined) return
  event.preventDefault()
  void stopService().then(() => { app.quit() }).catch((error: unknown) => {
    console.error(error)
    app.exit(1)
  })
})

process.once('SIGINT', () => { app.quit() })
process.once('SIGTERM', () => { app.quit() })

process.on('uncaughtException', (error) => {
  console.error(error)
  if (!quitting) app.quit()
})
