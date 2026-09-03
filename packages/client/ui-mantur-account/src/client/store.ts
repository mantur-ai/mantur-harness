/** Browser controller for the secret-free Mantur account Remote. */

import type { Context } from '@deepseek-ai/cordis'
import type {
  ManturAccount, ManturEnvironment, ManturEnvironmentStatus, ManturLoginAttemptId, ManturLoginStart,
} from '@deepseek-ai/dsh-authorization-manturhub/types'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'

/** Client-visible account state. */
export interface ManturAccountState {
  phase: 'idle' | 'loading' | 'signed-out' | 'starting' | 'authorizing' | 'signed-in' | 'failed' | 'signing-out'
  account?: ManturAccount
  login?: ManturLoginStart
  environment?: ManturEnvironmentStatus
  environmentBusy?: boolean
  environmentError?: 'missing-test-url' | 'failed'
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

  /**
   * @param ctx - client context carrying the generated Mantur account Remote.
   * @param reload - reloads browser controllers after a deployment change.
   */
  constructor(
    private readonly ctx: Context,
    private readonly reload: () => void = () => { window.location.reload() },
  ) {}

  /** Read the local Host grant status. */
  async load(): Promise<void> {
    const generation = ++this.generation
    this.clearTimer()
    this.transition({ phase: 'loading' })
    try {
      const status = unwrap('manturAccount.status', await this.ctx.remote.manturAccount.status())
      if (generation !== this.generation) return
      const environment: ManturEnvironmentStatus = {
        environment: status.environment,
        baseUrl: status.baseUrl,
        ...(status.testBaseUrl === undefined ? {} : { testBaseUrl: status.testBaseUrl }),
      }
      this.store.set(status.status === 'signed-in'
        ? { phase: 'signed-in', account: status.account, environment }
        : { phase: 'signed-out', environment })
    } catch {
      if (generation === this.generation) this.transition({ phase: 'failed' })
    }
  }

  /** Create one device session, then poll only its browser-safe progress. */
  async start(): Promise<void> {
    const generation = ++this.generation
    this.clearTimer()
    this.transition({ phase: 'starting' })
    try {
      const login = unwrap('manturAccount.startLogin', await this.ctx.remote.manturAccount.startLogin())
      if (generation !== this.generation) return
      this.transition({ phase: 'authorizing', login })
      this.schedulePoll(login.attemptId, generation)
    } catch {
      if (generation === this.generation) this.transition({ phase: 'failed' })
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
      this.transition({ phase: 'signed-out' })
    } catch {
      this.transition({ phase: 'failed' })
    }
  }

  /** Delete the Host credential record. */
  async signOut(): Promise<void> {
    const generation = ++this.generation
    this.clearTimer()
    this.transition({ phase: 'signing-out' })
    try {
      unwrap('manturAccount.signOut', await this.ctx.remote.manturAccount.signOut())
      if (generation === this.generation) {
        this.transition({ phase: 'signed-out' })
      }
    } catch {
      if (generation === this.generation) this.transition({ phase: 'failed' })
    }
  }

  /**
   * Persist a deployment selection, then reload every online Mantur controller.
   * @param environment - named deployment to activate.
   * @param testBaseUrl - explicit test origin, ignored when empty for production.
   */
  async setEnvironment(environment: ManturEnvironment, testBaseUrl: string): Promise<void> {
    const current = this.store.getSnapshot()
    const { environmentBusy: _busy, environmentError: _error, ...baseline } = current
    const normalizedTestBaseUrl = testBaseUrl.trim()
    if (environment === 'test' && normalizedTestBaseUrl === '') {
      this.store.set({ ...baseline, environmentError: 'missing-test-url' })
      return
    }
    const generation = ++this.generation
    this.clearTimer()
    this.store.set({ ...baseline, environmentBusy: true })
    try {
      unwrap('manturAccount.setEnvironment', await this.ctx.remote.manturAccount.setEnvironment({
        environment,
        ...(normalizedTestBaseUrl === '' ? {} : { testBaseUrl: normalizedTestBaseUrl }),
      }))
      if (generation === this.generation) this.reload()
    } catch {
      if (generation === this.generation) {
        this.store.set({ ...baseline, environmentBusy: false, environmentError: 'failed' })
      }
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
        this.transition({ phase: 'signed-in', account: progress.account })
      } else if (progress.status === 'cancelled') {
        this.transition({ phase: 'signed-out' })
      } else {
        this.transition({ phase: 'failed' })
      }
    } catch {
      if (generation === this.generation) this.transition({ phase: 'failed' })
    }
  }

  /** Preserve the loaded deployment facts across account-only state changes. */
  private transition(next: ManturAccountState): void {
    const environment = this.store.getSnapshot().environment
    this.store.set(environment === undefined || next.environment !== undefined
      ? next
      : { ...next, environment })
  }

  private clearTimer(): void {
    if (this.timer === undefined) return
    window.clearTimeout(this.timer)
    this.timer = undefined
  }
}
