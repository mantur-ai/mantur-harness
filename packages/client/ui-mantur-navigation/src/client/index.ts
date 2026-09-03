/** Mantur-only sidebar navigation and marketplace page registration. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-authorization-manturhub/remote'
import manturMarketplaceRemote from '@deepseek-ai/dsh-manturhub-marketplace/remote'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import {
  MarketplaceNavigation, MarketplacePage, ProjectsHeading,
} from './MarketplaceNavigation.tsx'
import { en, zh, type ManturNavigationKey } from './locales.ts'
import { ManturMarketplaceStore } from './store.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Mantur marketplace navigation and empty-page copy. */
    'navigation.mantur': ManturNavigationKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'navigation.mantur'

/** Required UI services and declarations. */
export const inject = ['slots', 'locale', 'remote']

/** Fill Mantur navigation, workspace terminology, and the root marketplace page. */
export async function apply(ctx: Context): Promise<void> {
  const disposeRemote = await ctx.remote.$mount(manturMarketplaceRemote)
  ctx.effect(() => disposeRemote, 'ui-mantur-navigation: marketplace Remote')
  ctx.inject(['remote.manturMarketplace', 'remote.manturAccount'], (scope: Context) => {
    scope.effect(() => scope.locale.register(NS, { zh, en }), 'ui-mantur-navigation: dictionaries')
    const controller = new ManturMarketplaceStore(scope)
    scope.effect(() => () => { controller.dispose() }, 'ui-mantur-navigation: marketplace controller')
    scope.slots.inject('sidebar.navigation', () =>
      scope.slots.inject('sidebar.workspaces.heading', () =>
        scope.slots.inject('main.page', function* () {
          yield scope.slots.register({ name: 'sidebar.navigation', locale: NS }, MarketplaceNavigation)
          yield scope.slots.register({ name: 'sidebar.workspaces.heading', locale: NS }, ProjectsHeading)
          yield scope.slots.register({
            name: 'main.page', locale: NS,
            inject: () => ({ controller, hooks: { marketplace: controller.store } }),
          }, MarketplacePage)
        })))
  })
}

export type {
  ManturMarketPageId, MarketplaceNavigationProps, MarketplacePageProps,
} from './MarketplaceNavigation.tsx'
export type { ManturNavigationKey } from './locales.ts'
