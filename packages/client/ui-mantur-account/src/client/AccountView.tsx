/** Shared Mantur account controls for onboarding and Settings. */

import { useEffect, useState, type ReactNode } from 'react'
import type { ManturEnvironment } from '@deepseek-ai/dsh-authorization-manturhub/types'
import type { ManturAccountState, ManturAccountStore } from './store.ts'
import type { en } from './locales.ts'
import css from './AccountView.module.css'

/** Presentation dependencies shared by both account surfaces. */
export interface AccountViewProps {
  state: ManturAccountState
  controller: ManturAccountStore
  t: (key: keyof typeof en) => string
  showSkip?: boolean
  onSkip?: () => void
  showEnvironment?: boolean
}

/** Render device authorization without accepting or displaying a secret. */
export function AccountView({ state, controller, t, showSkip, onSkip, showEnvironment }: AccountViewProps): ReactNode {
  const [environment, setEnvironment] = useState<ManturEnvironment>(state.environment?.environment ?? 'production')
  const [testBaseUrl, setTestBaseUrl] = useState(state.environment?.testBaseUrl ?? '')
  useEffect(() => {
    setEnvironment(state.environment?.environment ?? 'production')
    setTestBaseUrl(state.environment?.testBaseUrl ?? '')
  }, [state.environment])

  let account: ReactNode
  if (state.phase === 'signed-in') {
    account = (
      <div className={css.stack}>
        <strong>{t('signedIn')}</strong>
        <span>{state.account?.email}</span>
        <button type="button" onClick={() => { void controller.signOut() }}>{t('signOut')}</button>
      </div>
    )
  } else if (state.phase === 'authorizing' && state.login !== undefined) {
    account = (
      <div className={css.stack}>
        <span>{t('codeLabel')}</span>
        <strong className={css.code}>{state.login.userCode}</strong>
        <a href={state.login.verificationUrl} target="_blank" rel="noreferrer">{t('openBrowser')}</a>
        <span>{t('waiting')}</span>
        <button type="button" onClick={() => { void controller.cancel() }}>{t('cancel')}</button>
      </div>
    )
  } else {
    const busy = state.phase === 'loading' || state.phase === 'starting' || state.phase === 'signing-out'
    account = (
      <div className={css.stack}>
        <span>{state.phase === 'failed' ? t('failed') : t('signedOut')}</span>
        <button type="button" disabled={busy} onClick={() => { void controller.start() }}>
          {state.phase === 'starting' ? t('preparing') : state.phase === 'failed' ? t('retry') : t('login')}
        </button>
        {showSkip && <button type="button" disabled={busy} onClick={onSkip}>{t('skip')}</button>}
      </div>
    )
  }

  if (!showEnvironment || state.environment === undefined) return account
  const environmentBusy = state.environmentBusy === true
    || state.phase === 'starting'
    || state.phase === 'authorizing'
    || state.phase === 'signing-out'
  return (
    <div className={css.page}>
      <section className={css.environment}>
        <strong>{t('environmentTitle')}</strong>
        <span>{t('environmentDescription')}</span>
        <label>
          <span>{t('environmentLabel')}</span>
          <select
            value={environment}
            disabled={environmentBusy}
            onChange={(event) => { setEnvironment(event.target.value as ManturEnvironment) }}
          >
            <option value="production">{t('productionEnvironment')}</option>
            <option value="test">{t('testEnvironment')}</option>
          </select>
        </label>
        {environment === 'test' && (
          <label>
            <span>{t('testBaseUrlLabel')}</span>
            <input
              type="url"
              value={testBaseUrl}
              disabled={environmentBusy}
              placeholder={t('testBaseUrlPlaceholder')}
              onChange={(event) => { setTestBaseUrl(event.target.value) }}
            />
          </label>
        )}
        <small>{t('activeEndpoint')}: {state.environment.baseUrl}</small>
        {state.environmentError !== undefined && (
          <span className={css.error}>
            {t(state.environmentError === 'missing-test-url' ? 'missingTestBaseUrl' : 'environmentFailed')}
          </span>
        )}
        <button
          type="button"
          disabled={environmentBusy}
          onClick={() => { void controller.setEnvironment(environment, testBaseUrl) }}
        >
          {environmentBusy ? t('applyingEnvironment') : t('applyEnvironment')}
        </button>
      </section>
      {account}
    </div>
  )
}
