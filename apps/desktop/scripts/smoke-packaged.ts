/** Native smoke for the dependency closure inside one unpacked desktop application. */

import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { startDesktopService } from '../src/runtime.ts'

const desktopRoot = resolve(import.meta.dirname, '..')

function packagedPaths(): { electronExecutable: string; resourcesRoot: string } {
  if (process.platform === 'darwin') {
    const app = join(desktopRoot, 'dist', process.arch === 'arm64' ? 'mac-arm64' : 'mac', '漫途Agent.app')
    return {
      electronExecutable: join(app, 'Contents', 'MacOS', '漫途Agent'),
      resourcesRoot: join(app, 'Contents', 'Resources', 'app'),
    }
  }
  if (process.platform === 'win32') {
    const directory = join(desktopRoot, 'dist', 'win-unpacked')
    return {
      electronExecutable: join(directory, '漫途Agent.exe'),
      resourcesRoot: join(directory, 'resources', 'app'),
    }
  }
  throw new Error(`desktop packaged smoke does not support ${process.platform}`)
}

const packaged = packagedPaths()
const entry = join(packaged.resourcesRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
if (!existsSync(packaged.electronExecutable)) {
  throw new Error(`packaged Electron executable is missing: ${packaged.electronExecutable}`)
}
if (!existsSync(entry)) throw new Error(`packaged dsh entry is missing: ${entry}`)
const dshHome = mkdtempSync(join(tmpdir(), 'mantur-agent-desktop-smoke-'))

const service = startDesktopService({
  electronExecutable: packaged.electronExecutable,
  entry,
  environment: {
    ...process.env,
    DSH_HOME: dshHome,
    DSH_TELEMETRY_DISABLED: '1',
    NODE_PATH: '',
  },
})

try {
  const url = await service.ready
  const exchange = await fetch(url, { redirect: 'manual' })
  const setCookie = exchange.headers.get('set-cookie')
  if (exchange.status !== 303 || setCookie === null) {
    throw new Error(`packaged dsh Web authentication returned HTTP ${String(exchange.status)}`)
  }
  const response = await fetch(new URL(url).origin, {
    headers: { cookie: setCookie.split(';', 1)[0]! },
  })
  const html = await response.text()
  if (!response.ok) throw new Error(`packaged dsh Web returned HTTP ${String(response.status)}`)
  if (!html.includes('__DSH_BOOT__')) throw new Error('packaged dsh Web did not return its boot payload')
  if (!html.includes('<title>漫途Agent</title>')) throw new Error('packaged Web title is not 漫途Agent')
  console.log(`desktop packaged smoke: ${String(response.status)} ${new URL(url).origin}`)
} finally {
  service.stop()
  if (service.child.exitCode === null) await once(service.child, 'exit')
  rmSync(dshHome, { recursive: true, force: true })
}
