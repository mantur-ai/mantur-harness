/** Mantur's first ordered onboarding step. */

import { useEffect, type ReactNode } from 'react'
import { OnboardingSurface } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { AccountView } from './AccountView.tsx'
import type { ManturAccountState, ManturAccountStore } from './store.ts'
import type { en } from './locales.ts'
import css from './AccountOnboarding.module.css'

/** Registration dependencies of the Mantur account onboarding step. */
export interface AccountOnboardingInjected {
  controller: ManturAccountStore
  hooks: { account: SnapshotStore<ManturAccountState> }
  t: (key: keyof typeof en) => string
}

/** Full onboarding slot props. */
export type AccountOnboardingProps = PropsRuntime<'settings.onboarding'> & InjectFace<AccountOnboardingInjected>

/** Render login-or-skip before the existing DeepSeek credential step. */
export function AccountOnboarding(props: AccountOnboardingProps): ReactNode {
  const { complete, controller, t, useAccount } = props
  const state = useAccount(snapshot => snapshot)
  useEffect(() => {
    if (state.phase === 'idle') void controller.load()
  }, [controller, state.phase])
  useEffect(() => {
    if (state.phase === 'signed-in') complete()
  }, [complete, state.phase])
  if (state.phase === 'idle' || state.phase === 'loading' || state.phase === 'signed-in') return null
  return (
    <OnboardingSurface>
      <section className={css.card} aria-labelledby="mantur-account-onboarding-title">
        <h1 id="mantur-account-onboarding-title">{t('onboardingTitle')}</h1>
        <p>{t('onboardingDescription')}</p>
        <AccountView state={state} controller={controller} t={t} showSkip onSkip={complete} />
      </section>
    </OnboardingSurface>
  )
}
