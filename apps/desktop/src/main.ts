/** Thin native window over the shipped dsh Web profile. */

import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { desktopCopy } from './locales.ts'
import { startDesktopService, type DesktopService } from './runtime.ts'

const APP_NAME = '漫途Agent'
const STARTUP_PAGE = fileURLToPath(new URL('../resources/startup.html', import.meta.url))

let mainWindow: BrowserWindow | undefined
let service: DesktopService | undefined
let serviceUrl: string | undefined
let quitting = false

app.setName(APP_NAME)

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

async function showStartupError(error: unknown): Promise<void> {
  const copy = desktopCopy(app.getLocale())
  const detail = error instanceof Error ? error.message : String(error)
  await dialog.showMessageBox({
    type: 'error',
    title: copy.startupFailedTitle,
    message: copy.startupFailedMessage,
    detail,
  })
}

async function launch(): Promise<void> {
  const window = createWindow()
  service = startDesktopService({
    electronExecutable: process.execPath,
    environment: process.env,
  })
  service.child.once('exit', (code, signal) => {
    if (quitting || serviceUrl === undefined) return
    void showStartupError(new Error(
      `dsh stopped while the desktop window was running (code ${String(code)}, signal ${String(signal)}).`,
    )).finally(() => { app.quit() })
  })
  try {
    serviceUrl = await service.ready
    await window.loadURL(serviceUrl)
  } catch (error) {
    await showStartupError(error)
    app.quit()
  }
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
    void showStartupError(error).finally(() => { app.quit() })
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

app.on('before-quit', () => {
  quitting = true
  service?.stop()
})

process.on('uncaughtException', (error) => {
  console.error(error)
  if (!quitting) app.quit()
})
