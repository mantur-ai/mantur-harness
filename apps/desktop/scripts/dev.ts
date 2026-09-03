/** Start one watched desktop development cycle. */

import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  desktopDevelopmentStages,
  DesktopDevelopmentRunner,
  type DesktopDevelopmentProcess,
  type DesktopDevelopmentStage,
} from '../src/development.ts'

const desktopRoot = resolve(import.meta.dirname, '..')

function startStage(stage: DesktopDevelopmentStage, cwd: string): DesktopDevelopmentProcess {
  const child = spawn(stage.command, stage.args, { cwd, stdio: 'inherit' })
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => { resolve({ code, signal }) })
  })
  return {
    get exitCode() { return child.exitCode },
    get signalCode() { return child.signalCode },
    closed,
    kill: signal => child.kill(signal),
  }
}

async function main(): Promise<void> {
  const runner = new DesktopDevelopmentRunner(desktopDevelopmentStages(), startStage, desktopRoot)
  process.once('SIGINT', () => { runner.stop('SIGINT') })
  process.once('SIGTERM', () => { runner.stop() })
  process.exitCode = await runner.run()
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && pathToFileURL(resolve(invokedPath)).href === import.meta.url) {
  void main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
