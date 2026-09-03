/** Mantur-only sidebar navigation and marketplace page registration. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import {
  MarketplaceNavigation, MarketplacePage, ProjectsHeading,
} from './MarketplaceNavigation.tsx'
import { en, zh, type ManturNavigationKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Mantur marketplace navigation and empty-page copy. */
    'navigation.mantur': ManturNavigationKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'navigation.mantur'

/** Required UI services and declarations. */
export const inject = ['slots', 'locale']

/** Fill Mantur navigation, workspace terminology, and the root marketplace page. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-mantur-navigation: dictionaries')
  ctx.slots.inject('sidebar.navigation', () =>
    ctx.slots.inject('sidebar.workspaces.heading', () =>
      ctx.slots.inject('main.page', function* () {
        yield ctx.slots.register({ name: 'sidebar.navigation', locale: NS }, MarketplaceNavigation)
        yield ctx.slots.register({ name: 'sidebar.workspaces.heading', locale: NS }, ProjectsHeading)
        yield ctx.slots.register({ name: 'main.page', locale: NS }, MarketplacePage)
      })))
}

export {
  MANTUR_MARKET_PAGES, MarketplaceNavigation, MarketplacePage, ProjectsHeading,
} from './MarketplaceNavigation.tsx'
export type {
  ManturMarketPageId, MarketplaceNavigationProps, MarketplacePageProps,
} from './MarketplaceNavigation.tsx'
export type { ManturNavigationKey } from './locales.ts'
