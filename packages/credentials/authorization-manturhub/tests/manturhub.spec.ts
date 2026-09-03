import { createServer, type Server, type ServerResponse } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuthorizationService from '@deepseek-ai/dsh-authorization'
import type { ManturLoginAttemptId, ManturLoginProgress } from '@deepseek-ai/dsh-authorization-manturhub/types'
import { LocalCredentialProvider } from '@deepseek-ai/dsh-credentials-local'
import ManturHubAuthorization, { MANTUR_ACCOUNT_CREDENTIAL, readManturHubJson } from '../src/index.ts'

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  while (cleanups.length > 0) await cleanups.pop()!()
})

type PollEnvelope =
  | { status: 'pending' | 'slow_down' | 'access_denied' | 'denied' | 'expired' }
  | { error: 'pending' | 'slow_down' | 'access_denied' | 'denied' | 'expired' }
  | { status: 'ready'; key: string }

interface FakeHubOptions {
  session?: (origin: string) => { status?: number; body: unknown }
  polls?: readonly PollEnvelope[]
  pollHttpStatus?: number
  account?: { status?: number; body: unknown }
}

async function fakeHub(options: FakeHubOptions = {}): Promise<{ origin: string; requests: string[] }> {
  const requests: string[] = []
  const polls = [...(options.polls ?? [{ status: 'ready', key: 'mantur-secret-key' }])]
  let pollIndex = 0
  let origin = ''
  const server: Server = createServer((request, response) => {
    requests.push(`${request.method} ${request.url} ${request.headers['x-api-key'] ?? ''}`)
    if (request.method === 'POST' && request.url === '/api/v1/cli/session') {
      const selected = options.session?.(origin) ?? {
        body: { device_code: 'device-secret', user_code: 'MANT-1234', verify_url: `${origin}/device` },
      }
      respond(response, selected.status ?? 200, selected.body)
      return
    }
    if (request.url === '/api/v1/cli/poll?device_code=device-secret') {
      const selected = polls[Math.min(pollIndex, polls.length - 1)]!
      pollIndex += 1
      respond(response, options.pollHttpStatus ?? 200, selected)
      return
    }
    if (request.url === '/api/v1/me' && request.headers['x-api-key'] === 'mantur-secret-key') {
      const selected = options.account ?? { body: { email: 'artist@example.com', balance: 88 } }
      respond(response, selected.status ?? 200, selected.body)
      return
    }
    respond(response, 404, { error: 'not found' })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('fake hub did not bind a TCP port')
  origin = `http://127.0.0.1:${address.port}`
  cleanups.push(() => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) resolve()
      else reject(error)
    })
  }))
  return { origin, requests }
}

function respond(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status
  if (body === null) {
    response.end()
    return
  }
  response.setHeader('content-type', 'application/json')
  response.end(typeof body === 'string' ? body : JSON.stringify(body))
}

async function boot(origin?: string): Promise<{ ctx: Context; service: ManturHubAuthorization; path: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-mantur-account-'))
  cleanups.push(() => rm(dir, { recursive: true, force: true }))
  const path = join(dir, '.credentials.yaml')
  const ctx = new Context()
  cleanups.push(async () => { await ctx.fiber.dispose() })
  await ctx.plugin(LocalCredentialProvider, { path, watch: false })
  await ctx.plugin(AuthorizationService)
  const fiber = origin === undefined
    ? ctx.plugin(ManturHubAuthorization)
    : ctx.plugin(ManturHubAuthorization, { baseUrl: origin })
  await fiber.await()
  return { ctx, service: ctx.manturAccount, path }
}

async function settled(service: ManturHubAuthorization, attemptId: ManturLoginAttemptId): Promise<ManturLoginProgress> {
  for (let index = 0; index < 200; index += 1) {
    const progress = service.loginProgress(attemptId)
    if (progress.status !== 'pending') return progress
    await new Promise<void>(resolve => setImmediate(resolve))
  }
  throw new Error('fake ManturHub login did not settle')
}

async function waitForRequestCount(requests: readonly string[], prefix: string, count: number): Promise<void> {
  for (let index = 0; index < 200; index += 1) {
    if (requests.filter(request => request.startsWith(prefix)).length === count) return
    await new Promise<void>(resolve => setImmediate(resolve))
  }
  throw new Error(`fake ManturHub did not receive ${count} ${prefix} requests`)
}

async function waitForTimerCount(count: number): Promise<void> {
  for (let index = 0; index < 200; index += 1) {
    if (vi.getTimerCount() === count) return
    await new Promise<void>(resolve => setImmediate(resolve))
  }
  throw new Error(`device flow did not schedule ${count} timer(s)`)
}

interface MockCallReader {
  readonly mock: { readonly calls: readonly (readonly unknown[])[] }
}

async function waitForTimeoutCall(timeout: MockCallReader, ms: number): Promise<void> {
  for (let index = 0; index < 200; index += 1) {
    if (timeout.mock.calls.some(call => call[1] === ms)) return
    await new Promise<void>(resolve => setImmediate(resolve))
  }
  throw new Error(`device flow did not schedule its ${ms} ms polling interval`)
}

async function waitForMockCall(mock: MockCallReader): Promise<void> {
  for (let index = 0; index < 200; index += 1) {
    if (mock.mock.calls.length > 0) return
    await new Promise<void>(resolve => setImmediate(resolve))
  }
  throw new Error('device flow did not clean up its polling timer')
}

describe('ManturHub device authorization', () => {
  it('shares bounded ManturHub JSON reads without changing caller diagnostics', async () => {
    await expect(readManturHubJson(
      new Response('{"ready":true}'),
      64,
      'response',
    )).resolves.toEqual({ ready: true })
    await expect(readManturHubJson(
      new Response('too large'),
      1,
      'metadata',
    )).rejects.toThrow('ManturHub metadata exceeded 1 bytes')
    await expect(readManturHubJson(
      new Response(null),
      64,
      'response',
    )).rejects.toThrow('ManturHub returned no response body')
  })

  it('uses session defaults, stores the key only on the Host, and projects only email', async () => {
    const hub = await fakeHub()
    const subject = await boot(hub.origin)
    const before = Date.now()

    const start = await subject.service.startLogin()
    expect(start).toMatchObject({ verificationUrl: `${hub.origin}/device`, userCode: 'MANT-1234' })
    expect(start.expiresAt).toBeGreaterThanOrEqual(before + 600_000)
    expect(start.expiresAt).toBeLessThanOrEqual(Date.now() + 600_000)
    expect(JSON.stringify(start)).not.toContain('mantur-secret-key')
    await expect(settled(subject.service, start.attemptId)).resolves.toEqual({
      status: 'authorized', account: { email: 'artist@example.com' },
    })
    await expect(subject.service.status()).resolves.toEqual({
      status: 'signed-in', account: { email: 'artist@example.com' },
    })
    expect(await subject.ctx.credentials.readRecord(MANTUR_ACCOUNT_CREDENTIAL)).toEqual({
      kind: 'grant',
      payload: { version: 1, apiKey: 'mantur-secret-key', account: { email: 'artist@example.com' } },
    })
    expect(await readFile(subject.path, 'utf8')).toContain('mantur-secret-key')
    expect(hub.requests).toContain('GET /api/v1/me mantur-secret-key')
    await expect(subject.service.startLogin()).rejects.toThrow('already signed in')

    await subject.service.signOut()
    await expect(subject.service.status()).resolves.toEqual({ status: 'signed-out' })
    await expect(subject.ctx.credentials.readRecord(MANTUR_ACCOUNT_CREDENTIAL)).resolves.toBeUndefined()
  })

  it('uses the production ManturHub origin when configuration omits baseUrl', async () => {
    const subject = await boot()

    await expect(subject.service.status()).resolves.toEqual({ status: 'signed-out' })
  })

  it('never sends a stored grant to a URL that parses outside the configured origin', async () => {
    const hub = await fakeHub()
    const foreign = await fakeHub()
    const subject = await boot(hub.origin)
    await expect(subject.service.request('/api/v1/me', { authenticated: true })).resolves.toBeUndefined()
    await expect(subject.service.request('api/v1/me', { authenticated: false })).rejects.toThrow('root-relative')
    await expect(subject.service.request('//wrong.example/collect', { authenticated: false }))
      .rejects.toThrow('root-relative')
    const controller = new AbortController()
    const publicResponse = await subject.service.request('/public', {
      authenticated: false,
      headers: { 'x-client': 'fixture' },
      redirect: 'manual',
      signal: controller.signal,
    })
    expect(publicResponse?.status).toBe(404)

    const start = await subject.service.startLogin()
    await expect(settled(subject.service, start.attemptId)).resolves.toMatchObject({ status: 'authorized' })
    await expect(subject.service.request('/api/v1/me', { authenticated: true }))
      .resolves.toMatchObject({ status: 200 })
    const foreignHost = new URL(foreign.origin).host

    await expect(subject.service.request(`/\\${foreignHost}/collect`, { authenticated: true }))
      .rejects.toThrow('root-relative')
    expect(foreign.requests).toEqual([])
  })

  it('also runs through the shared authorization service without a Remote attempt', async () => {
    const hub = await fakeHub()
    const subject = await boot(hub.origin)
    const notices: unknown[] = []

    await expect(subject.ctx.authorization.begin({
      key: MANTUR_ACCOUNT_CREDENTIAL,
      method: 'device-code',
      interaction: {
        notify: (notice) => { notices.push(notice) },
        prompt: () => Promise.reject(new Error('not used')),
      },
    })).resolves.toEqual({ status: 'authorized' })

    expect(notices).toEqual([{
      message: 'Continue in your browser to authorize Mantur Agent.',
      url: `${hub.origin}/device`,
      code: 'MANT-1234',
    }])
    await expect(subject.service.status()).resolves.toEqual({
      status: 'signed-in', account: { email: 'artist@example.com' },
    })
  })

  it('rejects an unexpected prompt requested through its Remote-owned interaction', async () => {
    const hub = await fakeHub()
    const subject = await boot(hub.origin)
    vi.spyOn(subject.ctx.authorization, 'begin').mockImplementationOnce(async (request) => {
      await request.interaction.prompt({ kind: 'text', message: 'unexpected' })
      return { status: 'cancelled' }
    })

    await expect(subject.service.startLogin()).rejects.toThrow('could not be started')
  })

  it('increases the default polling interval after slow_down', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const hub = await fakeHub({ polls: [
      { status: 'pending' },
      { status: 'slow_down' },
      { status: 'ready', key: 'mantur-secret-key' },
    ] })
    const subject = await boot(hub.origin)

    const start = await subject.service.startLogin()
    const prefix = 'GET /api/v1/cli/poll'
    await waitForRequestCount(hub.requests, prefix, 1)
    await waitForTimerCount(1)
    await vi.advanceTimersByTimeAsync(4_999)
    expect(hub.requests.filter(request => request.startsWith(prefix))).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    await waitForRequestCount(hub.requests, prefix, 2)
    await waitForTimerCount(1)
    await vi.advanceTimersByTimeAsync(10_000)
    await waitForRequestCount(hub.requests, prefix, 3)
    await expect(settled(subject.service, start.attemptId)).resolves.toEqual({
      status: 'authorized', account: { email: 'artist@example.com' },
    })
  })

  it.each([
    { status: 'expired' } as const,
    { status: 'denied' } as const,
    { error: 'access_denied' } as const,
  ])('settles a terminal poll response as a failed attempt', async (poll) => {
    const hub = await fakeHub({ polls: [poll] })
    const subject = await boot(hub.origin)

    const start = await subject.service.startLogin()

    await expect(settled(subject.service, start.attemptId)).resolves.toEqual({ status: 'failed' })
    await expect(subject.ctx.credentials.readRecord(MANTUR_ACCOUNT_CREDENTIAL)).resolves.toBeUndefined()
  })

  it('rejects a duplicate attempt and distinguishes matching from foreign cancellation', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const timeout = vi.spyOn(globalThis, 'setTimeout')
    const clearTimeout = vi.spyOn(globalThis, 'clearTimeout')
    const hub = await fakeHub({ polls: [{ status: 'pending' }] })
    const subject = await boot(hub.origin)

    const start = await subject.service.startLogin()
    await expect(subject.service.startLogin()).rejects.toThrow('already running')
    subject.service.cancelLogin('foreign' as ManturLoginAttemptId)
    expect(subject.service.loginProgress(start.attemptId)).toEqual({ status: 'pending' })
    await waitForTimeoutCall(timeout, 5_000)
    subject.service.cancelLogin(start.attemptId)

    await expect(settled(subject.service, start.attemptId)).resolves.toEqual({ status: 'cancelled' })
    await waitForMockCall(clearTimeout)
    expect(() => subject.service.loginProgress('foreign' as ManturLoginAttemptId)).toThrow('unknown')
  })

  it('signs out while a device attempt is active', async () => {
    const hub = await fakeHub({ polls: [{ status: 'pending' }] })
    const subject = await boot(hub.origin)
    const start = await subject.service.startLogin()

    await subject.service.signOut()

    await expect(settled(subject.service, start.attemptId)).resolves.toEqual({ status: 'cancelled' })
  })

  it('cancels an active attempt when its plugin context is disposed', async () => {
    const hub = await fakeHub({ polls: [{ status: 'pending' }] })
    const subject = await boot(hub.origin)
    const start = await subject.service.startLogin()

    await subject.ctx.fiber.dispose()

    await expect(settled(subject.service, start.attemptId)).resolves.toEqual({ status: 'cancelled' })
  })

  it.each([
    ['cross-origin verification URL', () => ({
      body: { device_code: 'device-secret', user_code: 'MANT-1234', verify_url: 'https://wrong.example/device' },
    })],
    ['HTTP failure', (origin: string) => ({ status: 503, body: { error: origin } })],
    ['missing response body', () => ({ status: 204, body: null })],
    ['invalid JSON', (origin: string) => ({ body: `${origin}{` })],
    ['oversized response', () => ({ body: 'x'.repeat(64 * 1024 + 1) })],
  ] as const)('fails login startup for a %s', async (_label, session) => {
    const hub = await fakeHub({ session })
    const subject = await boot(hub.origin)

    await expect(subject.service.startLogin()).rejects.toThrow('could not be started')
    await expect(subject.service.status()).resolves.toEqual({ status: 'signed-out' })
  })

  it('rejects invalid endpoint configuration and damaged local credentials', async () => {
    expect(() => new ManturHubAuthorization(new Context())).toThrow()
    expect(() => new ManturHubAuthorization(new Context(), { baseUrl: 'ftp://example.com' })).toThrow('baseUrl must be')
    expect(() => new ManturHubAuthorization(new Context(), { baseUrl: 'https://example.com/path' }))
      .toThrow('baseUrl must be')
    const hub = await fakeHub()
    const subject = await boot(hub.origin)
    await subject.ctx.credentials.modifyRecord(
      MANTUR_ACCOUNT_CREDENTIAL,
      () => Promise.resolve({ kind: 'api-key', key: 'wrong-record-kind' }),
    )

    await expect(subject.service.status()).rejects.toThrow('could not be read')
  })

  it('reports account verification and local sign-out failures', async () => {
    const hub = await fakeHub({ account: { status: 500, body: { error: 'broken' } } })
    const subject = await boot(hub.origin)
    const start = await subject.service.startLogin()
    await expect(settled(subject.service, start.attemptId)).resolves.toEqual({ status: 'failed' })

    vi.spyOn(subject.ctx.credentials, 'deleteRecord').mockRejectedValueOnce(new Error('disk failed'))
    await expect(subject.service.signOut()).rejects.toThrow('could not be signed out')
  })

  it.each([
    { status: 'pending' } as const,
    { status: 'ready', key: 'mantur-secret-key' } as const,
  ])('fails a non-success $status polling response without retrying it', async (poll) => {
    const hub = await fakeHub({ polls: [poll], pollHttpStatus: 503 })
    const subject = await boot(hub.origin)
    const start = await subject.service.startLogin()

    await expect(settled(subject.service, start.attemptId)).resolves.toEqual({ status: 'failed' })
    expect(hub.requests.filter(request => request.startsWith('GET /api/v1/cli/poll'))).toHaveLength(1)
  })
})
