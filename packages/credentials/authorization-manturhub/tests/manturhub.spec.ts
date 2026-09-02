import { createServer, type Server } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import AuthorizationService from '@deepseek-ai/dsh-authorization'
import { LocalCredentialProvider } from '@deepseek-ai/dsh-credentials-local'
import ManturHubAuthorization, { MANTUR_ACCOUNT_CREDENTIAL } from '../src/index.ts'

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!()
})

async function fakeHub(pollStatus: 'pending' | 'ready' = 'ready'): Promise<{ origin: string; requests: string[] }> {
  const requests: string[] = []
  let origin = ''
  const server: Server = createServer((request, response) => {
    requests.push(`${request.method} ${request.url} ${request.headers['x-api-key'] ?? ''}`)
    response.setHeader('content-type', 'application/json')
    if (request.method === 'POST' && request.url === '/api/v1/cli/session') {
      response.end(JSON.stringify({
        device_code: 'device-secret', user_code: 'MANT-1234', verify_url: `${origin}/device`,
        interval: 1, expires_in: 300,
      }))
      return
    }
    if (request.url === '/api/v1/cli/poll?device_code=device-secret') {
      response.end(JSON.stringify(pollStatus === 'ready'
        ? { status: 'ready', key: 'mantur-secret-key' }
        : { status: 'pending' }))
      return
    }
    if (request.url === '/api/v1/me' && request.headers['x-api-key'] === 'mantur-secret-key') {
      response.end(JSON.stringify({ id: 'account-1', email: 'artist@example.com', name: '创作者' }))
      return
    }
    response.statusCode = 404
    response.end(JSON.stringify({ error: 'not found' }))
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

async function boot(origin: string): Promise<{ ctx: Context; service: ManturHubAuthorization; path: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-mantur-account-'))
  cleanups.push(() => rm(dir, { recursive: true, force: true }))
  const path = join(dir, '.credentials.yaml')
  const ctx = new Context()
  await ctx.plugin(LocalCredentialProvider, { path, watch: false })
  await ctx.plugin(AuthorizationService)
  const fiber = ctx.plugin(ManturHubAuthorization, { baseUrl: origin })
  await fiber.await()
  cleanups.push(async () => { await ctx.fiber.dispose() })
  return { ctx, service: ctx.manturAccount, path }
}

async function settled(service: ManturHubAuthorization, attemptId: Awaited<ReturnType<ManturHubAuthorization['startLogin']>>['attemptId']) {
  for (let index = 0; index < 20; index += 1) {
    const progress = service.loginProgress(attemptId)
    if (progress.status !== 'pending') return progress
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
  throw new Error('fake ManturHub login did not settle')
}

describe('ManturHub device authorization', () => {
  it('returns only browser instructions and stores the API key in the Host credential record', async () => {
    const hub = await fakeHub()
    const subject = await boot(hub.origin)

    const start = await subject.service.startLogin()
    expect(start).toMatchObject({ verificationUrl: `${hub.origin}/device`, userCode: 'MANT-1234' })
    expect(JSON.stringify(start)).not.toContain('mantur-secret-key')
    await expect(settled(subject.service, start.attemptId)).resolves.toEqual({
      status: 'authorized',
      account: { id: 'account-1', email: 'artist@example.com', name: '创作者' },
    })
    await expect(subject.service.status()).resolves.toEqual({
      status: 'signed-in',
      account: { id: 'account-1', email: 'artist@example.com', name: '创作者' },
    })
    expect(await subject.ctx.credentials.readRecord(MANTUR_ACCOUNT_CREDENTIAL)).toEqual({
      kind: 'grant',
      payload: {
        version: 1,
        apiKey: 'mantur-secret-key',
        account: { id: 'account-1', email: 'artist@example.com', name: '创作者' },
      },
    })
    expect(await readFile(subject.path, 'utf8')).toContain('mantur-secret-key')
    expect(hub.requests).toContain('GET /api/v1/me mantur-secret-key')

    await subject.service.signOut()
    await expect(subject.service.status()).resolves.toEqual({ status: 'signed-out' })
    await expect(subject.ctx.credentials.readRecord(MANTUR_ACCOUNT_CREDENTIAL)).resolves.toBeUndefined()
  })

  it('cancels a pending device authorization attempt without storing a credential', async () => {
    const hub = await fakeHub('pending')
    const subject = await boot(hub.origin)

    const start = await subject.service.startLogin()
    subject.service.cancelLogin(start.attemptId)

    await expect(settled(subject.service, start.attemptId)).resolves.toEqual({ status: 'cancelled' })
    await expect(subject.ctx.credentials.readRecord(MANTUR_ACCOUNT_CREDENTIAL)).resolves.toBeUndefined()
  })
})
