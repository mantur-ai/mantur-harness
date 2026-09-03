/** Browser state for the ManturHub Skill marketplace. */

import type { Context } from '@deepseek-ai/cordis'
import type { ManturLoginAttemptId, ManturLoginStart } from '@deepseek-ai/dsh-authorization-manturhub/types'
import type {
  ManturMarketplaceCatalog, ManturMarketplaceSkillDetail,
} from '@deepseek-ai/dsh-manturhub-marketplace/types'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'

/** Client-visible marketplace state. */
export type ManturMarketplaceState =
  | { readonly phase: 'idle' | 'loading' }
  | { readonly phase: 'failed' }
  | {
    readonly phase: 'ready'
    readonly catalog: ManturMarketplaceCatalog
    readonly detail?: ManturMarketplaceSkillDetail | undefined
    readonly detailLoading?: string | undefined
    readonly installing?: string | undefined
    readonly installError?: 'auth-required' | 'local-conflict' | 'failed' | undefined
    readonly login?: ManturLoginStart | undefined
    readonly loginPhase?: 'starting' | 'authorizing' | 'failed' | undefined
  }

/** Convert one generated Remote result into its value. */
function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  if (result.ok) return result.value
  throw new Error(`${result.error.code}: ${result.error.message}`)
}

/** Root-scoped controller for catalog and detail reads. */
export class ManturMarketplaceStore {
  /** Snapshot consumed by the Skill page. */
  readonly store: SnapshotStore<ManturMarketplaceState> = createSnapshotStore({ phase: 'idle' })
  private generation = 0
  private loginGeneration = 0
  private loginTimer: number | undefined

  /** @param ctx - client context carrying the generated marketplace Remote. */
  constructor(private readonly ctx: Context) {}

  /** Load the public catalog and local installation flags. */
  async load(): Promise<void> {
    const generation = ++this.generation
    this.store.set({ phase: 'loading' })
    try {
      const catalog = unwrap(await this.ctx.remote.manturMarketplace.list())
      if (generation === this.generation) this.store.set({ phase: 'ready', catalog })
    } catch {
      if (generation === this.generation) this.store.set({ phase: 'failed' })
    }
  }

  /**
   * Load the selected Skill's public detail.
   * @param slug - Catalog slug selected by the user.
   */
  async openDetail(slug: string): Promise<void> {
    const current = this.store.getSnapshot()
    if (current.phase !== 'ready') return
    const generation = ++this.generation
    this.store.set({ phase: 'ready', catalog: current.catalog, detailLoading: slug })
    try {
      const detail = unwrap(await this.ctx.remote.manturMarketplace.detail(slug))
      if (generation === this.generation) this.store.set({ phase: 'ready', catalog: current.catalog, detail })
    } catch {
      if (generation === this.generation) this.store.set({ phase: 'ready', catalog: current.catalog })
    }
  }

  /** Close the current detail without refetching the catalog. */
  closeDetail(): void {
    const current = this.store.getSnapshot()
    if (current.phase !== 'ready') return
    ++this.generation
    this.store.set({ phase: 'ready', catalog: current.catalog })
  }

  /**
   * Install one selected Skill, preserving explicit authentication and conflict failures.
   * @param slug - Catalog slug approved by the user.
   */
  async install(slug: string): Promise<void> {
    const current = this.store.getSnapshot()
    if (current.phase !== 'ready' || current.installing !== undefined) return
    if (!current.catalog.signedIn) {
      this.store.set({ ...current, installError: 'auth-required' })
      return
    }
    this.store.set({ ...current, installing: slug, installError: undefined })
    const result = await this.ctx.remote.manturMarketplace.install(slug)
    const pending = this.store.getSnapshot()
    if (pending.phase !== 'ready' || pending.installing !== slug) return
    if (!result.ok) {
      const installError = result.error.code === 'mantur-marketplace/auth-required'
        ? 'auth-required'
        : result.error.code === 'mantur-marketplace/local-conflict'
          ? 'local-conflict'
          : 'failed'
      this.store.set({ ...pending, installing: undefined, installError })
      return
    }
    const skills = pending.catalog.skills.map(skill => skill.slug === slug
      ? { ...skill, installed: true }
      : skill)
    const newlyInstalled = pending.catalog.skills.some(skill => skill.slug === slug && !skill.installed)
    this.store.set({
      ...pending,
      installing: undefined,
      installError: undefined,
      catalog: {
        ...pending.catalog,
        skills,
        installedCount: pending.catalog.installedCount + (newlyInstalled ? 1 : 0),
      },
      ...(pending.detail?.slug === slug ? { detail: { ...pending.detail, installed: true } } : {}),
    })
  }

  /** Begin ManturHub device login from the installation gate. */
  async startLogin(): Promise<void> {
    const current = this.store.getSnapshot()
    if (current.phase !== 'ready' || current.loginPhase === 'starting' || current.loginPhase === 'authorizing') return
    const generation = ++this.loginGeneration
    this.clearLoginTimer()
    this.store.set({ ...current, installError: undefined, loginPhase: 'starting', login: undefined })
    const result = await this.ctx.remote.manturAccount.startLogin()
    const latest = this.store.getSnapshot()
    if (generation !== this.loginGeneration || latest.phase !== 'ready') return
    if (!result.ok) {
      this.store.set({ ...latest, loginPhase: 'failed' })
      return
    }
    this.store.set({ ...latest, login: result.value, loginPhase: 'authorizing' })
    this.scheduleLoginPoll(result.value.attemptId, generation)
  }

  /** Cancel the login attempt started from this marketplace. */
  async cancelLogin(): Promise<void> {
    const current = this.store.getSnapshot()
    if (current.phase !== 'ready' || current.login === undefined) return
    ++this.loginGeneration
    this.clearLoginTimer()
    const result = await this.ctx.remote.manturAccount.cancelLogin(current.login.attemptId)
    const latest = this.store.getSnapshot()
    if (latest.phase !== 'ready') return
    this.store.set(result.ok
      ? { ...latest, login: undefined, loginPhase: undefined }
      : { ...latest, loginPhase: 'failed' })
  }

  /** Make in-flight Remote settlements stale. */
  dispose(): void {
    ++this.generation
    ++this.loginGeneration
    this.clearLoginTimer()
  }

  private scheduleLoginPoll(attemptId: ManturLoginAttemptId, generation: number): void {
    this.loginTimer = window.setTimeout(() => { void this.pollLogin(attemptId, generation) }, 750)
  }

  private async pollLogin(attemptId: ManturLoginAttemptId, generation: number): Promise<void> {
    const result = await this.ctx.remote.manturAccount.loginProgress(attemptId)
    const current = this.store.getSnapshot()
    if (generation !== this.loginGeneration || current.phase !== 'ready') return
    if (!result.ok) {
      this.store.set({ ...current, loginPhase: 'failed' })
      return
    }
    if (result.value.status === 'pending') {
      this.scheduleLoginPoll(attemptId, generation)
    } else if (result.value.status === 'authorized') {
      this.store.set({
        ...current,
        catalog: { ...current.catalog, signedIn: true },
        installError: undefined,
        login: undefined,
        loginPhase: undefined,
      })
    } else if (result.value.status === 'cancelled') {
      this.store.set({ ...current, login: undefined, loginPhase: undefined })
    } else {
      this.store.set({ ...current, loginPhase: 'failed' })
    }
  }

  private clearLoginTimer(): void {
    if (this.loginTimer === undefined) return
    window.clearTimeout(this.loginTimer)
    this.loginTimer = undefined
  }
}
