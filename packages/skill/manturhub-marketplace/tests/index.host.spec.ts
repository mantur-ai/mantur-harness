import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { ManturHubRequestOptions } from '@deepseek-ai/dsh-authorization-manturhub'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { afterEach, describe, expect, it } from 'vitest'
import ManturHubMarketplace from '../src/index.ts'

const skill = {
  slug: 'story-director',
  name: '故事导演',
  description: '把故事变成分镜',
  category: '剧本创作',
  version: '1.2.3',
  triggers: ['写分镜'],
  uses_operators: ['op.text.generate'],
  intro_md: null,
  assets: { logo_url: 'https://cdn.example/story.png' },
  kind: 'skill',
}

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!()
})

async function subject(
  request: (pathname: string, options: ManturHubRequestOptions) => Promise<Response | undefined>,
  options: { readonly signedIn?: boolean; readonly maxMetadataBytes?: number } = {},
): Promise<{ readonly home: string; readonly service: ManturHubMarketplace }> {
  const home = await mkdtemp(join(tmpdir(), 'dsh-mantur-index-'))
  cleanups.push(() => rm(home, { recursive: true, force: true }))
  const ctx = new Context()
  cleanups.push(async () => { await ctx.fiber.dispose() })
  ctx.provide('manturAccount', {
    request,
    status: () => Promise.resolve(options.signedIn === false
      ? { status: 'signed-out' as const }
      : { status: 'signed-in' as const, account: { email: 'artist@example.com' } }),
  } as never)
  return {
    home,
    service: new ManturHubMarketplace(ctx, {
      dshHome: home,
      ...(options.maxMetadataBytes === undefined ? {} : { maxMetadataBytes: options.maxMetadataBytes }),
    }),
  }
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('ManturHub marketplace metadata failures', () => {
  it('projects optional artwork, missing introduction, and signed-out state', async () => {
    const target = await subject(pathname => Promise.resolve(json(
      pathname === '/api/v1/skills' ? [skill] : skill,
    )), { signedIn: false })

    await expect(target.service.list()).resolves.toMatchObject({
      signedIn: false,
      skills: [{ logoUrl: skill.assets.logo_url }],
    })
    const detail = await target.service.detail(skill.slug)
    expect(detail).toMatchObject({ logoUrl: skill.assets.logo_url })
    expect(detail).not.toHaveProperty('introduction')
  })

  it.each([
    ['missing response', undefined],
    ['HTTP failure', new Response('', { status: 503 })],
    ['missing body', new Response(null, { status: 200 })],
  ])('maps a catalog %s to a gateway failure', async (_label, response) => {
    const target = await subject(() => Promise.resolve(response))
    await expect(target.service.list()).rejects.toMatchObject({ code: 'gateway/internal' })
  })

  it('bounds and validates catalog metadata', async () => {
    const oversized = await subject(() => Promise.resolve(json([skill])), { maxMetadataBytes: 1 })
    await expect(oversized.service.list()).rejects.toMatchObject({ code: 'gateway/internal' })

    const malformed = await subject(() => Promise.resolve(json({ skills: [{ slug: false }] })))
    await expect(malformed.service.list()).rejects.toMatchObject({ code: 'gateway/internal' })
  })

  it('preserves a RemoteError raised by the account request', async () => {
    const failure = new RemoteError('gateway/bad-request', 'fixture rejection', {})
    const target = await subject(() => Promise.reject(failure))
    await expect(target.service.list()).rejects.toBe(failure)
  })

  it('reports a local installation-state filesystem error', async () => {
    const target = await subject(() => Promise.resolve(json([skill])))
    await writeFile(join(target.home, 'skills'), 'not a directory')
    await expect(target.service.list()).rejects.toMatchObject({ code: 'gateway/internal' })
  })

  it.each([
    ['missing response', undefined],
    ['HTTP failure', new Response('', { status: 503 })],
    ['missing body', new Response(null, { status: 200 })],
  ])('maps a detail %s to a gateway failure', async (_label, response) => {
    const target = await subject(() => Promise.resolve(response))
    await expect(target.service.detail(skill.slug)).rejects.toMatchObject({ code: 'gateway/internal' })
  })

  it('rejects invalid, oversized, and mismatched detail metadata', async () => {
    const invalid = await subject(() => Promise.resolve(json({ skill: { slug: false } })))
    await expect(invalid.service.detail(skill.slug)).rejects.toMatchObject({ code: 'gateway/internal' })

    const oversized = await subject(() => Promise.resolve(json(skill)), { maxMetadataBytes: 1 })
    await expect(oversized.service.detail(skill.slug)).rejects.toMatchObject({ code: 'gateway/internal' })

    const mismatched = await subject(() => Promise.resolve(json({ ...skill, slug: 'other-skill' })))
    await expect(mismatched.service.detail(skill.slug)).rejects.toMatchObject({ code: 'gateway/internal' })
  })

  it('rejects invalid slugs before any request', async () => {
    let requests = 0
    const target = await subject(() => {
      requests += 1
      return Promise.resolve(json(skill))
    })
    await expect(target.service.detail('../escape')).rejects.toMatchObject({ code: 'gateway/bad-request' })
    await expect(target.service.install('../escape')).rejects.toMatchObject({ code: 'gateway/bad-request' })
    expect(requests).toBe(0)
  })

  it('preserves detail RemoteErrors through the serialized install operation', async () => {
    const failure = new RemoteError('gateway/bad-request', 'fixture rejection', {})
    const target = await subject(() => Promise.reject(failure))
    await expect(target.service.install(skill.slug)).rejects.toBe(failure)
  })
})
