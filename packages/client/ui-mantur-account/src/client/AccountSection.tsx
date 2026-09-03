/** Mantur account Settings page. */

import { useEffect } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { AccountView } from './AccountView.tsx'
import type { ManturAccountState, ManturAccountStore } from './store.ts'
import type { en } from './locales.ts'

/** Registration dependencies of the account Settings page. */
export interface AccountSectionInjected {
  controller: ManturAccountStore
  hooks: { account: SnapshotStore<ManturAccountState> }
  t: (key: keyof typeof en) => string
}

/** Full settings section props. */
export type AccountSectionProps = PropsRuntime<'settings.section'> & InjectFace<AccountSectionInjected>

/** Render current account status plus login and local sign-out controls. */
export function AccountSection({ controller, t, useAccount }: AccountSectionProps) {
  const state = useAccount(snapshot => snapshot)
  useEffect(() => {
    if (state.phase === 'idle') void controller.load()
  }, [controller, state.phase])
  return <AccountView state={state} controller={controller} t={t} showEnvironment />
}
