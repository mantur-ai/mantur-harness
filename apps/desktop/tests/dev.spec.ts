/** Desktop development restart lifecycle. */

import { describe, expect, it, vi } from 'vitest'
import {
  DesktopDevelopmentRunner,
  type DesktopDevelopmentProcess,
  type DesktopDevelopmentStage,
} from '../src/development.ts'

class FakeProcess implements DesktopDevelopmentProcess {
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null
  private closeProcess: ((result: { code: number | null; signal: NodeJS.Signals | null }) => void) | undefined
  readonly closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    this.closeProcess = resolve
  })
  kill = vi.fn((signal: NodeJS.Signals) => signal.length > 0)

  close(code: number | null, signal: NodeJS.Signals | null = null): void {
    this.exitCode = code
    this.signalCode = signal
    this.closeProcess?.({ code, signal })
  }
}

const stages: DesktopDevelopmentStage[] = [
  { label: 'compile', command: 'node', args: ['tsc'] },
  { label: 'bundle', command: 'node', args: ['tsdown'] },
  { label: 'Electron', command: 'electron', args: ['.'] },
]

describe('desktop development runner', () => {
  it('runs compile, bundle, and Electron in order', async () => {
    const started: string[] = []
    const runner = new DesktopDevelopmentRunner(stages, (stage) => {
      started.push(stage.label)
      const child = new FakeProcess()
      queueMicrotask(() => { child.close(0) })
      return child
    }, '/desktop')

    await expect(runner.run()).resolves.toBe(0)
    expect(started).toEqual(['compile', 'bundle', 'Electron'])
  })

  it('waits for the active process to close before a watched restart can continue', async () => {
    const child = new FakeProcess()
    const start = vi.fn(() => child)
    const runner = new DesktopDevelopmentRunner(stages, start, '/desktop')
    let completed = false
    const run = runner.run().then((code) => {
      completed = true
      return code
    })
    await Promise.resolve()

    runner.stop()

    expect(child.kill).toHaveBeenCalledWith('SIGTERM')
    expect(completed).toBe(false)
    child.close(null, 'SIGTERM')
    await expect(run).resolves.toBe(0)
    expect(start).toHaveBeenCalledOnce()
  })

  it('does not start later stages after a compile failure', async () => {
    const start = vi.fn(() => {
      const child = new FakeProcess()
      queueMicrotask(() => { child.close(2) })
      return child
    })
    const runner = new DesktopDevelopmentRunner(stages, start, '/desktop')

    await expect(runner.run()).resolves.toBe(2)
    expect(start).toHaveBeenCalledOnce()
  })
})
