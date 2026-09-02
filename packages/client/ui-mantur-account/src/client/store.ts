/** Browser controller for the secret-free Mantur account Remote. */

import type { Context } from '@deepseek-ai/cordis'
import type {
  ManturAccount, ManturLoginAttemptId, ManturLoginStart,
} from '@deepseek-ai/dsh-authorization-manturhub/types'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'

/** Client-visible account state. */
export interface ManturAccountState {
  phase: 'idle' | 'loading' | 'signed-out' | 'starting' | 'authorizing' | 'signed-in' | 'failed' | 'signing-out'
  account?: ManturAccount
  login?: ManturLoginStart
}

/** Convert a failed Remote result into a local operation error. */
function unwrap<T>(operation: string, result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  if (result.ok) return result.value
  throw new Error(`${operation} failed: ${result.error.code}: ${result.error.message}`)
}

/** One root-scoped Mantur account controller shared by onboarding and Settings. */
export class ManturAccountStore {
  /** Browser-safe snapshot; it can never contain the Host credential grant. */
  readonly store: SnapshotStore<ManturAccountState> = createSnapshotStore({ phase: 'idle' })
  private timer: number | undefined
  private generation = 0

  /** @param ctx - client context carrying the generated Mantur account Remote. */
  constructor(private readonly ctx: Context) {}

  /** Read the local Host grant status. */
  async load(): Promise<void> {
    const generation = ++this.generation
    this.clearTimer()
    this.store.set({ phase: 'loading' })
    try {
      const status = unwrap('manturAccount.status', await this.ctx.remote.manturAccount.status())
      if (generation !== this.generation) return
      this.store.set(status.status === 'signed-in'
        ? { phase: 'signed-in', account: status.account }
        : { phase: 'signed-out' })
    } catch {
      if (generation === this.generation) this.store.set({ phase: 'failed' })
    }
  }

  /** Create one device session, then poll only its browser-safe progress. */
  async start(): Promise<void> {
    const generation = ++this.generation
    this.clearTimer()
    this.store.set({ phase: 'starting' })
    try {
      const login = unwrap('manturAccount.startLogin', await this.ctx.remote.manturAccount.startLogin())
      if (generation !== this.generation) return
      this.store.set({ phase: 'authorizing', login })
      this.schedulePoll(login.attemptId, generation)
    } catch {
      if (generation === this.generation) this.store.set({ phase: 'failed' })
    }
  }

  /** Cancel the active Host attempt and return to signed-out state. */
  async cancel(): Promise<void> {
    const state = this.store.getSnapshot()
    if (state.login === undefined) return
    ++this.generation
    this.clearTimer()
    try {
      unwrap('manturAccount.cancelLogin', await this.ctx.remote.manturAccount.cancelLogin(state.login.attemptId))
      this.store.set({ phase: 'signed-out' })
    } catch {
      this.store.set({ phase: 'failed' })
    }
  }

  /** Delete the Host credential record. */
  async signOut(): Promise<void> {
    const generation = ++this.generation
    this.clearTimer()
    this.store.set({ phase: 'signing-out' })
    try {
      unwrap('manturAccount.signOut', await this.ctx.remote.manturAccount.signOut())
      if (generation === this.generation) this.store.set({ phase: 'signed-out' })
    } catch {
      if (generation === this.generation) this.store.set({ phase: 'failed' })
    }
  }

  /** Stop client timers and make in-flight settlements stale. */
  dispose(): void {
    ++this.generation
    this.clearTimer()
  }

  private schedulePoll(attemptId: ManturLoginAttemptId, generation: number): void {
    this.timer = window.setTimeout(() => { void this.poll(attemptId, generation) }, 750)
  }

  private async poll(attemptId: ManturLoginAttemptId, generation: number): Promise<void> {
    try {
      const progress = unwrap(
        'manturAccount.loginProgress',
        await this.ctx.remote.manturAccount.loginProgress(attemptId),
      )
      if (generation !== this.generation) return
      if (progress.status === 'pending') {
        this.schedulePoll(attemptId, generation)
      } else if (progress.status === 'authorized') {
        this.store.set({ phase: 'signed-in', account: progress.account })
      } else if (progress.status === 'cancelled') {
        this.store.set({ phase: 'signed-out' })
      } else {
        this.store.set({ phase: 'failed' })
      }
    } catch {
      if (generation === this.generation) this.store.set({ phase: 'failed' })
    }
  }

  private clearTimer(): void {
    if (this.timer === undefined) return
    window.clearTimeout(this.timer)
    this.timer = undefined
  }
}
