import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import {
  MarketplaceNavigation, MarketplacePage, ProjectsHeading,
} from '../src/client/MarketplaceNavigation.tsx'
import * as clientEntry from '../src/client/index.ts'
import { apply, inject } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'

async function bench() {
  const ctx = new Context()
  ctx.provide('remote', { $mount: () => Promise.resolve(() => {}) } as never)
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const slots = ctx.get('slots') as SlotRegistry
  slots.register({
    name: 'root',
    children: {
      'sidebar.navigation': { kind: 'single', scope: 'root' },
      'sidebar.workspaces.heading': { kind: 'single', scope: 'root' },
      'main.page': { kind: 'single', scope: 'root' },
    },
  } as never, () => null)
  return { ctx, locale, slots }
}

describe('ui-mantur-navigation apply', () => {
  it('keeps the host entry inert and declares browser services', () => {
    expect(hostApply).not.toThrow()
    expect(inject).toEqual(['slots', 'locale', 'remote'])
    expect(Object.keys(clientEntry).sort()).toEqual(['apply', 'inject'])
  })

  it('registers all Mantur occupants and removes them together on unload', async () => {
    const subject = await bench()
    const fiber = subject.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(subject.slots.entries('sidebar.navigation')[0]?.component).toBe(MarketplaceNavigation)
    expect(subject.slots.entries('sidebar.workspaces.heading')[0]?.component).toBe(ProjectsHeading)
    const mainPage = subject.slots.entries('main.page')[0]
    expect(mainPage?.component).toBe(MarketplacePage)
    const injected = (mainPage?.inject as (() => { controller: unknown; hooks: { marketplace: unknown } }))()
    expect(injected.controller).toBeTruthy()
    expect(injected.hooks.marketplace).toBeTruthy()
    expect(subject.locale.bind('navigation.mantur')('projects')).toBe('项目')

    await fiber.dispose()
    expect(subject.slots.entries('sidebar.navigation')).toEqual([])
    expect(subject.slots.entries('sidebar.workspaces.heading')).toEqual([])
    expect(subject.slots.entries('main.page')).toEqual([])
  })
})
