/** Mantur account onboarding and Settings occupants. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import manturAccountRemote from '@deepseek-ai/dsh-authorization-manturhub/remote'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { AccountOnboarding, type AccountOnboardingInjected } from './AccountOnboarding.tsx'
import { AccountSection, type AccountSectionInjected } from './AccountSection.tsx'
import { ManturAccountStore } from './store.ts'
import { en, zh, type ManturAccountKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Mantur account onboarding and Settings copy. */
    'settings.manturAccount': ManturAccountKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.manturAccount'

/** Services required by the two account surfaces. */
export const inject = ['slots', 'locale', 'remote']

/** Register Mantur account onboarding before model credentials and expose later sign-out. */
export async function apply(ctx: Context): Promise<void> {
  const disposeRemote = await ctx.remote.$mount(manturAccountRemote)
  ctx.effect(() => disposeRemote, 'ui-mantur-account: Remote contribution')
  ctx.inject(['remote.manturAccount'], (scope: Context) => {
    scope.effect(() => scope.locale.register(NS, { zh, en }), 'ui-mantur-account: dictionaries')
    const controller = new ManturAccountStore(scope)
    const t = scope.locale.bind(NS)
    const injected = (): AccountOnboardingInjected & AccountSectionInjected => ({
      controller,
      hooks: { account: controller.store },
      t,
    })
    scope.effect(() => () => { controller.dispose() }, 'ui-mantur-account: controller')
    scope.slots.inject('settings.onboarding', () => scope.slots.register({
      name: 'settings.onboarding', id: 'mantur-account', order: -100, locale: NS, inject: injected,
    }, AccountOnboarding))
    scope.slots.inject('settings.section', () => scope.slots.register({
      name: 'settings.section', id: 'mantur-account', order: 5,
      label: () => t('nav'), locale: NS, inject: injected,
    }, AccountSection))
  })
}
