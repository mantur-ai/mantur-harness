import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { AccountOnboarding } from '../src/client/AccountOnboarding.tsx'
import { AccountSection } from '../src/client/AccountSection.tsx'
import { apply, inject } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const remote = new TestRemote(ctx, {
    manturAccount: {
      status: vi.fn(() => Promise.resolve({ ok: true, value: { status: 'signed-out' } })),
      startLogin: vi.fn(),
      loginProgress: vi.fn(),
      cancelLogin: vi.fn(),
      signOut: vi.fn(),
    },
  })
  remote.$mount = vi.fn(() => Promise.resolve(() => Promise.resolve()))
  const slots = ctx.get('slots') as SlotRegistry
  slots.register({
    name: 'root',
    children: {
      'settings.section': { kind: 'list', scope: 'root' },
      'settings.onboarding': { kind: 'list', scope: 'root' },
    },
  } as never, () => null)
  return { ctx, slots, locale }
}

describe('ui-mantur-account apply', () => {
  it('keeps the host Loader entry inert and declares the browser services', () => {
    expect(hostApply).not.toThrow()
    expect(inject).toEqual(['slots', 'locale', 'remote'])
  })

  it('registers login before DeepSeek setup and exposes the account Settings page', async () => {
    const subject = await bench()
    const fiber = subject.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(subject.slots.entries('settings.onboarding')[0]).toMatchObject({
      component: AccountOnboarding,
      options: { id: 'mantur-account', order: -100 },
    })
    const onboarding = subject.slots.entries('settings.onboarding')[0]!
    const injectOnboarding = onboarding.inject as () => {
      controller: unknown
      hooks: { account: unknown }
      t: unknown
    }
    const injected = injectOnboarding()
    expect(injected.controller).toBeDefined()
    expect(injected.hooks.account).toBeDefined()
    expect(typeof injected.t).toBe('function')
    const section = subject.slots.entries('settings.section')[0]!
    expect(section).toMatchObject({
      component: AccountSection,
      options: { id: 'mantur-account', order: 5 },
    })
    expect(resolveSlotLabel(section.options.label)).toBe('漫途账号')
    expect(subject.locale.bind('settings.manturAccount')('login')).toBe('登录漫途账号')
    await fiber.dispose()
    expect(subject.slots.entries('settings.onboarding')).toEqual([])
    expect(subject.slots.entries('settings.section')).toEqual([])
  })
})
