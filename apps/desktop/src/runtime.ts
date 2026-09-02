/** Start and supervise the existing dsh Web profile inside the Electron runtime. */

import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

const READY_PATTERN = /^dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+)/mu
const OUTPUT_LIMIT = 64 * 1_024

/** A running dsh process and its authenticated startup URL. */
export interface DesktopService {
  /** Child process running the shipped dsh CLI through Electron's Node mode. */
  child: ChildProcessByStdio<null, Readable, Readable>
  /** Resolves only after the Web profile announces its tokenized loopback URL. */
  ready: Promise<string>
  /** Request normal process termination. */
  stop: () => void
}

/** Options for starting the desktop-owned dsh process. */
export interface StartDesktopServiceOptions {
  /** Electron executable reused as the Node runtime. */
  electronExecutable: string
  /** Built dsh CLI entry; defaults to the installed workspace dependency. */
  entry?: string
  /** Process environment inherited by dsh before desktop-owned values replace it. */
  environment?: NodeJS.ProcessEnv
  /** Maximum wait for the Web readiness line. */
  timeoutMs?: number
}

/** Resolve the built CLI entry from the desktop application's dependency closure. */
export function resolveDshEntry(): string {
  return fileURLToPath(import.meta.resolve('@deepseek-ai/dsh/lib/bin.js'))
}

/** Extract an authenticated loopback URL from accumulated dsh output. */
export function extractReadyUrl(output: string): string | undefined {
  return READY_PATTERN.exec(output)?.[1]
}

/** Build the only supported application launch: the shipped dsh Web profile. */
export function buildDshArguments(entry: string): string[] {
  return [
    '--expose-internals',
    entry,
    '--profile',
    'web',
    '--host',
    '127.0.0.1',
    '--port',
    '0',
    '--no-open',
  ]
}

/**
 * Start the Web profile and wait for its tokenized local URL.
 * @param options - Electron runtime, optional CLI entry, environment, and deadline.
 * @returns supervised child process and readiness promise.
 */
export function startDesktopService(options: StartDesktopServiceOptions): DesktopService {
  const entry = options.entry ?? resolveDshEntry()
  const timeoutMs = options.timeoutMs ?? 60_000
  const child = spawn(options.electronExecutable, buildDshArguments(entry), {
    env: {
      ...options.environment,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_OPTIONS: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let output = ''
  let settled = false
  let timeout: NodeJS.Timeout | undefined
  const ready = new Promise<string>((resolve, reject) => {
    const finish = (): boolean => {
      if (settled) return false
      settled = true
      if (timeout !== undefined) clearTimeout(timeout)
      return true
    }
    const inspect = (chunk: Buffer | string): void => {
      if (settled) return
      output = `${output}${String(chunk)}`.slice(-OUTPUT_LIMIT)
      const url = extractReadyUrl(output)
      if (url !== undefined && finish()) resolve(url)
    }

    child.stdout.on('data', inspect)
    child.stderr.on('data', inspect)
    child.once('error', (error) => {
      if (finish()) reject(error)
    })
    child.once('exit', (code, signal) => {
      if (finish()) {
        reject(new Error(`dsh stopped before desktop readiness (code ${String(code)}, signal ${String(signal)}).\n${output}`))
      }
    })
    timeout = setTimeout(() => {
      child.kill()
      if (finish()) reject(new Error(`dsh did not become ready within ${String(timeoutMs)}ms.\n${output}`))
    }, timeoutMs)
  })

  return {
    child,
    ready,
    stop: () => {
      if (child.exitCode === null && !child.killed) child.kill()
    },
  }
}
