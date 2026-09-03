/** ManturHub device authorization and browser-safe account Remote. */

import { randomUUID } from 'node:crypto'
import { Context } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'
import type { AuthorizationSession } from '@deepseek-ai/dsh-authorization'
import { credentialKey, type CredentialRecord } from '@deepseek-ai/dsh-credentials'
import { brandString } from '@deepseek-ai/dsh-brand'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import type {
  ManturAccount,
  ManturAccountStatus,
  ManturLoginAttemptId,
  ManturLoginProgress,
  ManturLoginStart,
} from './types.ts'

export type * from './types.ts'

/** Credential record owned by this authorization provider. */
export const MANTUR_ACCOUNT_CREDENTIAL = credentialKey('authorization-manturhub', 'account')

/** ManturHub deployment endpoint. */
export interface Config {
  /** HTTP origin serving the ManturHub device and account APIs. */
  readonly baseUrl?: string
}

interface ResolvedConfig {
  readonly baseUrl: URL
}

interface StoredGrant {
  readonly version: 1
  readonly apiKey: string
  readonly account: ManturAccount
}

interface Attempt {
  readonly id: ManturLoginAttemptId
  readonly ready: PromiseWithResolvers<ManturLoginStart>
  progress: ManturLoginProgress
}

/** Host-only options for one request to the configured ManturHub origin. */
export interface ManturHubRequestOptions {
  /** Attach the locally stored account grant; unsigned callers receive `undefined`. */
  readonly authenticated: boolean
  /** Additional non-secret request headers. */
  readonly headers?: HeadersInit
  /** Abort the network request. */
  readonly signal?: AbortSignal
  /** Redirect handling for the caller-owned protocol. */
  readonly redirect?: RequestRedirect
}

const responseLimitBytes = 64 * 1024
const defaultBaseUrl = 'https://hub.mantur.ai'

const deviceSessionSchema = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verify_url: z.url(),
  interval: z.number().int().min(1).default(5),
  expires_in: z.number().int().positive().default(600),
})

const nonReadyPollStatusSchema = z.enum([
  'pending',
  'slow_down',
  'access_denied',
  'denied',
  'expired',
])

const devicePollSchema = z.union([
  z.object({ status: nonReadyPollStatusSchema }),
  z.object({ error: nonReadyPollStatusSchema }),
  z.object({ status: z.literal('ready'), key: z.string().min(1) }),
])

const accountSchema = z.object({
  email: z.string().min(1),
})

const storedGrantSchema = z.object({
  version: z.literal(1),
  apiKey: z.string().min(1),
  account: accountSchema,
})

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the ManturHub account Remote namespace. */
    manturAccount: ManturHubAuthorization
  }
}

/** Resolve and validate the one deployment-varying endpoint. */
function resolveConfig(config: Config): ResolvedConfig {
  const baseUrl = new URL(config.baseUrl ?? defaultBaseUrl)
  if (!['http:', 'https:'].includes(baseUrl.protocol)
    || baseUrl.username !== ''
    || baseUrl.password !== ''
    || baseUrl.pathname !== '/'
    || baseUrl.search !== ''
    || baseUrl.hash !== '') {
    throw new TypeError('authorization-manturhub: baseUrl must be an HTTP(S) origin without credentials, query, or fragment')
  }
  return { baseUrl }
}

/** Read one bounded JSON response from ManturHub. */
async function responseJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader()
  if (reader === undefined) throw new Error('ManturHub returned no response body')
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    length += chunk.value.byteLength
    if (length > responseLimitBytes) {
      await reader.cancel()
      throw new Error(`ManturHub response exceeded ${responseLimitBytes} bytes`)
    }
    chunks.push(chunk.value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}

/** Reject non-success HTTP responses after consuming their bounded body. */
async function requireJson(response: Response): Promise<unknown> {
  const body = await responseJson(response)
  if (!response.ok) throw new Error(`ManturHub request failed with HTTP ${response.status}`)
  return body
}

/** Wait for the server-directed polling interval, withdrawing promptly. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  const timeout = Promise.withResolvers<void>()
  const aborted = Promise.withResolvers<void>()
  const timer = setTimeout(timeout.resolve, ms)
  const onAbort: EventListener = aborted.reject
  signal.addEventListener('abort', onAbort, { once: true })
  return Promise.race([timeout.promise, aborted.promise]).finally(() => {
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
  })
}

/** Project the exact account fields allowed onto the browser wire and record. */
function projectAccount(value: z.infer<typeof accountSchema>): ManturAccount {
  return { email: value.email }
}

/** Normalize ManturHub's status and OAuth-style error response fields. */
function parsePoll(value: unknown):
  | { readonly status: z.infer<typeof nonReadyPollStatusSchema> }
  | { readonly status: 'ready'; readonly key: string } {
  const parsed = devicePollSchema.parse(value)
  return 'error' in parsed ? { status: parsed.error } : parsed
}

/** Parse this plugin's private grant record and fail on foreign or damaged data. */
function parseGrant(record: CredentialRecord | undefined): StoredGrant | undefined {
  if (record === undefined) return undefined
  if (record.kind !== 'grant') throw new Error('ManturHub account credential has the wrong record kind')
  const parsed = storedGrantSchema.parse(record.payload)
  return { version: 1, apiKey: parsed.apiKey, account: projectAccount(parsed.account) }
}

/** Host service registering the ManturHub authorization flow and account Remote. */
export class ManturHubAuthorization extends TypertRemoteService {
  static inject = ['authorization', 'credentials']

  static Config: s<Config> = s.object({
    baseUrl: s.string().default(defaultBaseUrl),
  })

  private readonly config: ResolvedConfig
  private currentAttempt: Attempt | undefined
  private lastAttempt: Attempt | undefined

  /**
   * @param ctx - Host context carrying authorization and credential services.
   * @param config - ManturHub endpoint selection.
   */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'manturAccount', { namespace: 'manturAccount' })
    this.config = resolveConfig(config)
    ctx.effect(() => ctx.authorization.registerFlow({
      key: MANTUR_ACCOUNT_CREDENTIAL,
      label: 'ManturHub',
      methods: [{ id: 'device-code', label: 'Device code' }],
      run: session => this.runDeviceFlow(session, this.currentAttempt),
    }), 'authorization-manturhub: device flow')
    ctx.effect(() => () => {
      if (this.currentAttempt !== undefined) ctx.authorization.cancel(MANTUR_ACCOUNT_CREDENTIAL)
    }, 'authorization-manturhub: cancel active attempt')
  }

  /**
   * Send a Host-only GET to this account provider's configured deployment.
   *
   * The method accepts only root-relative paths so a stored grant cannot be
   * forwarded to another origin. It is intentionally not a browser Remote.
   *
   * @param pathname - root-relative ManturHub API path.
   * @param options - authentication, headers, cancellation, and redirect policy.
   * @returns the response, or `undefined` when authentication was requested while signed out.
   */
  async request(pathname: string, options: ManturHubRequestOptions): Promise<Response | undefined> {
    if (!pathname.startsWith('/') || pathname.startsWith('//')) {
      throw new TypeError('authorization-manturhub: request pathname must be root-relative')
    }
    const headers = new Headers(options.headers)
    if (options.authenticated) {
      const grant = parseGrant(await this.ctx.credentials.readRecord(MANTUR_ACCOUNT_CREDENTIAL))
      if (grant === undefined) return undefined
      headers.set('x-api-key', grant.apiKey)
    }
    return await fetch(new URL(pathname, this.config.baseUrl), {
      headers,
      redirect: options.redirect ?? 'error',
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    })
  }

  /**
   * Read local sign-in state without exposing the stored API key.
   * @returns signed-out or the sanitized account committed with the grant.
   */
  @Remote
  async status(): Promise<ManturAccountStatus> {
    try {
      const grant = parseGrant(await this.ctx.credentials.readRecord(MANTUR_ACCOUNT_CREDENTIAL))
      return grant === undefined
        ? { status: 'signed-out' }
        : { status: 'signed-in', account: grant.account }
    } catch (error) {
      throw new RemoteError('gateway/internal', 'ManturHub account credential could not be read', {}, { cause: error })
    }
  }

  /**
   * Start one process-local device authorization attempt.
   * @returns browser-safe verification instructions after ManturHub creates the device session.
   */
  @Remote
  async startLogin(): Promise<ManturLoginStart> {
    if (this.currentAttempt !== undefined) {
      throw new RemoteError('gateway/bad-request', 'a ManturHub login attempt is already running', {})
    }
    if ((await this.status()).status === 'signed-in') {
      throw new RemoteError('gateway/bad-request', 'the ManturHub account is already signed in', {})
    }

    const attempt: Attempt = {
      id: brandString<ManturLoginAttemptId>(randomUUID()),
      ready: Promise.withResolvers<ManturLoginStart>(),
      progress: { status: 'pending' },
    }
    this.currentAttempt = attempt
    this.lastAttempt = attempt
    void this.ctx.authorization.begin({
      key: MANTUR_ACCOUNT_CREDENTIAL,
      method: 'device-code',
      interaction: {
        notify: () => {},
        prompt: () => Promise.reject(new Error('ManturHub device authorization does not prompt in the client')),
      },
    }).then((outcome) => {
      if (outcome.status === 'cancelled') {
        attempt.progress = { status: 'cancelled' }
        attempt.ready.reject(new Error('ManturHub login was cancelled'))
        return
      }
    }).catch((error: unknown) => {
      this.ctx.logger.warn('authorization-manturhub: device login failed')
      this.ctx.logger.warn(error)
      attempt.progress = { status: 'failed' }
      attempt.ready.reject(error)
    }).finally(() => { this.currentAttempt = undefined })

    try {
      return await attempt.ready.promise
    } catch (error) {
      throw new RemoteError('gateway/internal', 'ManturHub login could not be started', {}, { cause: error })
    }
  }

  /**
   * Read one attempt's current process-local outcome.
   * @param attemptId - opaque id returned by {@link startLogin}.
   * @returns pending or the settled outcome; no secret is included.
   */
  @Remote
  loginProgress(attemptId: ManturLoginAttemptId): ManturLoginProgress {
    if (this.lastAttempt?.id !== attemptId) {
      throw new RemoteError('gateway/bad-request', 'unknown ManturHub login attempt', {})
    }
    return this.lastAttempt.progress
  }

  /**
   * Cancel the matching active attempt; a settled or unknown attempt is unchanged.
   * @param attemptId - opaque id returned by {@link startLogin}.
   */
  @Remote
  cancelLogin(attemptId: ManturLoginAttemptId): void {
    if (this.currentAttempt?.id !== attemptId) return
    this.ctx.authorization.cancel(MANTUR_ACCOUNT_CREDENTIAL)
  }

  /** Remove the local ManturHub grant and cancel any unfinished login. */
  @Remote
  async signOut(): Promise<void> {
    if (this.currentAttempt !== undefined) this.ctx.authorization.cancel(MANTUR_ACCOUNT_CREDENTIAL)
    try {
      await this.ctx.credentials.deleteRecord(MANTUR_ACCOUNT_CREDENTIAL)
    } catch (error) {
      throw new RemoteError('gateway/internal', 'ManturHub account could not be signed out', {}, { cause: error })
    }
  }

  /** Publish the first browser instruction to the matching process-local attempt. */
  private publishStart(
    attempt: Attempt | undefined,
    verificationUrl: URL,
    userCode: string,
    expiresInSeconds: number,
  ): void {
    if (attempt === undefined) return
    const start: ManturLoginStart = {
      attemptId: attempt.id,
      verificationUrl: verificationUrl.toString(),
      userCode,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    }
    attempt.ready.resolve(start)
  }

  /** Run the provider protocol and commit its grant before resolving. */
  private async runDeviceFlow(session: AuthorizationSession, attempt: Attempt | undefined): Promise<void> {
    const created = deviceSessionSchema.parse(await requireJson(await fetch(
      new URL('/api/v1/cli/session', this.config.baseUrl),
      { method: 'POST', redirect: 'error', signal: session.signal },
    )))
    const verificationUrl = new URL(created.verify_url)
    if (verificationUrl.origin !== this.config.baseUrl.origin) {
      throw new Error('ManturHub returned a verification URL on another origin')
    }
    this.publishStart(attempt, verificationUrl, created.user_code, created.expires_in)
    session.notify({
      message: 'Continue in your browser to authorize Mantur Agent.',
      url: verificationUrl.toString(),
      code: created.user_code,
    })

    let pollIntervalSeconds = created.interval
    while (true) {
      const response = await fetch(new URL(
        `/api/v1/cli/poll?device_code=${encodeURIComponent(created.device_code)}`,
        this.config.baseUrl,
      ), { redirect: 'error', signal: session.signal })
      const poll = parsePoll(await responseJson(response))
      if (poll.status === 'ready') {
        if (!response.ok) throw new Error(`ManturHub login poll failed with HTTP ${response.status}`)
        const account = projectAccount(accountSchema.parse(await requireJson(await fetch(
          new URL('/api/v1/me', this.config.baseUrl),
          {
            headers: { 'x-api-key': poll.key },
            redirect: 'error',
            signal: session.signal,
          },
        ))))
        const payload: StoredGrant = { version: 1, apiKey: poll.key, account }
        await this.ctx.credentials.modifyRecord(
          MANTUR_ACCOUNT_CREDENTIAL,
          () => Promise.resolve({ kind: 'grant', payload }),
        )
        if (attempt !== undefined) attempt.progress = { status: 'authorized', account }
        return
      }
      if (poll.status === 'expired' || poll.status === 'access_denied' || poll.status === 'denied') {
        throw new Error(`ManturHub device login ${poll.status}`)
      }
      if (!response.ok) throw new Error(`ManturHub login poll failed with HTTP ${response.status}`)
      if (poll.status === 'slow_down') pollIntervalSeconds += 5
      await wait(pollIntervalSeconds * 1000, session.signal)
    }
  }
}

export default ManturHubAuthorization
