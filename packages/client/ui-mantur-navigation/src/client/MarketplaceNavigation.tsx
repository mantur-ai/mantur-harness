/** Mantur feature navigation and root-page skeletons. */

import { useEffect, useMemo, useState, type ComponentType } from 'react'
import clsx from 'clsx'
import {
  IconChevronLeftOutline14, IconListPenOutline16, IconSearchOutline16,
  IconSkillOutline16, Modal, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { MainPageId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ManturNavigationKey } from './locales.ts'
import type { ManturMarketplaceState, ManturMarketplaceStore } from './store.ts'
import css from './MarketplaceNavigation.module.css'

/** Mantur root-page identifiers. */
export const MANTUR_MARKET_PAGES = {
  skills: 'mantur.skills' as MainPageId,
  recipes: 'mantur.recipes' as MainPageId,
} as const

/** Root page owned by this plugin. */
export type ManturMarketPageId = typeof MANTUR_MARKET_PAGES[keyof typeof MANTUR_MARKET_PAGES]

/** Full sidebar navigation props. */
export type MarketplaceNavigationProps =
  PropsRuntime<'sidebar.navigation'> & PropsLocale<'navigation.mantur'>

/** Full root-page props. */
export type MarketplacePageProps =
  PropsRuntime<'main.page'> & PropsLocale<'navigation.mantur'> & InjectFace<MarketplacePageInjected>

/** Marketplace page dependencies supplied by the client plugin. */
export interface MarketplacePageInjected {
  controller: ManturMarketplaceStore
  hooks: { marketplace: SnapshotStore<ManturMarketplaceState> }
}

interface NavigationItem {
  id: ManturMarketPageId
  label: 'skills.title' | 'recipes.title'
  icon: ComponentType<{ size?: number; className?: string }>
}

const items: readonly NavigationItem[] = [
  { id: MANTUR_MARKET_PAGES.skills, label: 'skills.title', icon: IconSkillOutline16 },
  { id: MANTUR_MARKET_PAGES.recipes, label: 'recipes.title', icon: IconListPenOutline16 },
]

/** Render the Mantur-only feature group above Projects. */
export function MarketplaceNavigation({ wide, activePage, openPage, t }: MarketplaceNavigationProps) {
  return (
    <nav className={clsx(css.navigation, !wide && css.rail)} aria-label={t('section.features')}>
      <div className={css.navigationItems}>
        {items.map(({ id, label, icon: Icon }) => {
          const selected = activePage === id
          const button = (
            <button
              key={id}
              type="button"
              className={clsx(css.navigationItem, selected && css.selected)}
              aria-current={selected ? 'page' : undefined}
              aria-label={t(label)}
              onClick={() => { openPage(id) }}
            >
              <Icon size={wide ? 16 : 18} />
              {wide && <span>{t(label)}</span>}
            </button>
          )
          return wide
            ? button
            : <Tooltip key={id} label={t(label)} side="right" delayMs={500}>{button}</Tooltip>
        })}
      </div>
    </nav>
  )
}

interface PageCopy {
  title: 'skills.title' | 'recipes.title'
  description: 'skills.description' | 'recipes.description'
  empty: 'skills.empty' | 'recipes.empty'
  icon: ComponentType<{ size?: number; className?: string }>
}

const pageCopy: Record<ManturMarketPageId, PageCopy> = {
  [MANTUR_MARKET_PAGES.skills]: {
    title: 'skills.title',
    description: 'skills.description',
    empty: 'skills.empty',
    icon: IconSkillOutline16,
  },
  [MANTUR_MARKET_PAGES.recipes]: {
    title: 'recipes.title',
    description: 'recipes.description',
    empty: 'recipes.empty',
    icon: IconListPenOutline16,
  },
}

/** Render the selected Mantur marketplace as an independent root page. */
export function MarketplacePage({ activePage, closePage, controller, useMarketplace, t }: MarketplacePageProps) {
  // Registry disposal unmounts the active occupant before a replacement can
  // render, so the layout must not retain this plugin's page identifier.
  useEffect(() => () => { closePage() }, [closePage])
  const copy = pageCopy[activePage]
  if (copy === undefined) throw new Error(`ui-mantur-navigation: unsupported main page "${activePage}"`)
  if (activePage === MANTUR_MARKET_PAGES.skills) {
    return <SkillMarketplace closePage={closePage} controller={controller} useMarketplace={useMarketplace} t={t} />
  }
  const Icon = copy.icon
  return (
    <main className={css.page} aria-labelledby="mantur-marketplace-title">
      <header className={css.pageHeader}>
        <button type="button" className={css.back} onClick={closePage}>
          <IconChevronLeftOutline14 />
          <span>{t('backToConversation')}</span>
        </button>
      </header>
      <section className={css.pageBody}>
        <div className={css.pageIdentity} aria-hidden="true"><Icon size={24} /></div>
        <h1 id="mantur-marketplace-title">{t(copy.title)}</h1>
        <p className={css.description}>{t(copy.description)}</p>
        <p className={css.empty}>{t(copy.empty)}</p>
      </section>
    </main>
  )
}

/** Render the live Skill catalog with reliable client-side filtering. */
function SkillMarketplace({ closePage, controller, useMarketplace, t }: {
  readonly closePage: () => void
  readonly controller: ManturMarketplaceStore
  readonly useMarketplace: MarketplacePageProps['useMarketplace']
  readonly t: MarketplacePageProps['t']
}) {
  const state = useMarketplace(snapshot => snapshot)
  const ready = state.phase === 'ready' ? state : undefined
  const detail = ready?.detail
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  useEffect(() => {
    if (state.phase === 'idle') void controller.load()
  }, [controller, state.phase])

  const skills = state.phase === 'ready' ? state.catalog.skills : []
  const categories = useMemo(
    () => [...new Set(skills.map(skill => skill.category))].sort((a, b) => a.localeCompare(b)),
    [skills],
  )
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return skills.filter(skill => (category === '' || skill.category === category)
      && (needle === '' || [skill.name, skill.description, ...skill.triggers]
        .some(value => value.toLocaleLowerCase().includes(needle))))
  }, [category, query, skills])
  const detailFooter = detail === undefined || ready === undefined
    ? undefined
    : detail.installed
      ? <button type="button" className={css.install} disabled>{t('skills.installed')}</button>
      : ready.catalog.signedIn
        ? (
          <button
            type="button"
            className={css.install}
            disabled={ready.installing !== undefined}
            onClick={() => { void controller.install(detail.slug) }}
          >
            {ready.installing === detail.slug ? t('skills.installing') : t('skills.install')}
          </button>
        )
        : (
          <button
            type="button"
            className={css.install}
            disabled={ready.loginPhase === 'starting' || ready.loginPhase === 'authorizing'}
            onClick={() => { void controller.startLogin() }}
          >
            {ready.loginPhase === 'starting' ? t('skills.loginPreparing') : t('skills.loginToInstall')}
          </button>
        )

  return (
    <main className={css.page} aria-labelledby="mantur-marketplace-title">
      <header className={css.pageHeader}>
        <button type="button" className={css.back} onClick={closePage}>
          <IconChevronLeftOutline14 />
          <span>{t('backToConversation')}</span>
        </button>
      </header>
      <section className={css.catalogBody}>
        <div className={css.catalogHeading}>
          <div>
            <h1 id="mantur-marketplace-title">{t('skills.title')}</h1>
            <p>{t('skills.description')}</p>
          </div>
          {state.phase === 'ready' && (
            <span className={css.installedCount}>{t('skills.installedCount').replace('{count}', String(state.catalog.installedCount))}</span>
          )}
        </div>

        {state.phase === 'ready' && (
          <>
            <label className={css.search}>
              <IconSearchOutline16 />
              <input value={query} onChange={(event) => { setQuery(event.target.value) }} placeholder={t('skills.search')} />
            </label>
            <div className={css.categories} aria-label={t('skills.categories')}>
              <button type="button" className={category === '' ? css.categoryActive : undefined} onClick={() => { setCategory('') }}>{t('skills.all')}</button>
              {categories.map(value => (
                <button key={value} type="button" className={category === value ? css.categoryActive : undefined} onClick={() => { setCategory(value) }}>{value}</button>
              ))}
            </div>
          </>
        )}

        {state.phase === 'idle' || state.phase === 'loading'
          ? <p className={css.status}>{t('skills.loading')}</p>
          : state.phase === 'failed'
            ? <div className={css.status}><p>{t('skills.failed')}</p><button type="button" onClick={() => { void controller.load() }}>{t('skills.retry')}</button></div>
            : visible.length === 0
              ? <p className={css.status}>{skills.length === 0 ? t('skills.empty') : t('skills.noMatches')}</p>
              : (
                <div className={css.skillGrid}>
                  {visible.map(skill => (
                    <article key={skill.slug} className={css.skillCard}>
                      <button type="button" className={css.cardMain} onClick={() => { void controller.openDetail(skill.slug) }}>
                        <span className={css.skillIcon} aria-hidden="true">{skill.name.slice(0, 1)}</span>
                        <span className={css.skillCopy}>
                          <strong>{skill.name}</strong>
                          <span>{skill.description}</span>
                        </span>
                      </button>
                      <div className={css.cardFooter}>
                        <span className={css.tag}>{skill.category}</span>
                        <button
                          type="button"
                          className={css.install}
                          disabled={skill.installed || ready?.installing !== undefined}
                          onClick={() => {
                            if (ready?.catalog.signedIn === true) void controller.install(skill.slug)
                            else void controller.openDetail(skill.slug)
                          }}
                        >
                          {skill.installed
                            ? t('skills.installed')
                            : ready?.installing === skill.slug
                              ? t('skills.installing')
                              : ready?.catalog.signedIn === true
                                ? t('skills.install')
                                : t('skills.view')}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
      </section>
      <Modal
        open={detail !== undefined || ready?.detailLoading !== undefined}
        onClose={() => { controller.closeDetail() }}
        title={detail?.name ?? t('skills.loadingDetail')}
        closeLabel={t('close')}
        {...(detail === undefined ? {} : { description: detail.description })}
        {...(detailFooter === undefined ? {} : { footer: detailFooter })}
      >
        {detail !== undefined && ready !== undefined && (
          <div className={css.detail}>
            <div><span className={css.tag}>{detail.category}</span><span>v{detail.version}</span></div>
            {detail.introduction !== undefined && <p>{detail.introduction}</p>}
            {ready.installError === 'local-conflict' && <p className={css.installError}>{t('skills.localConflict')}</p>}
            {ready.installError === 'failed' && <p className={css.installError}>{t('skills.installFailed')}</p>}
            {ready.loginPhase === 'failed' && <p className={css.installError}>{t('skills.loginFailed')}</p>}
            {ready.loginPhase === 'authorizing' && ready.login !== undefined && (
              <div className={css.loginGate}>
                <span>{t('skills.loginCode')}</span>
                <strong>{ready.login.userCode}</strong>
                <a href={ready.login.verificationUrl} target="_blank" rel="noreferrer">{t('skills.openLogin')}</a>
                <button type="button" onClick={() => { void controller.cancelLogin() }}>{t('skills.cancelLogin')}</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </main>
  )
}

/** Render Mantur's product term for the generic workspace section. */
export function ProjectsHeading({ t }: PropsLocale<'navigation.mantur'>) {
  return <>{t('projects')}</>
}

export type { ManturNavigationKey }
