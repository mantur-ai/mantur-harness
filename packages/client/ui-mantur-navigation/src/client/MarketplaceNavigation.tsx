/** Mantur feature navigation and root-page skeletons. */

import type { ComponentType } from 'react'
import clsx from 'clsx'
import {
  IconChevronLeftOutline14, IconListPenOutline16, IconSkillOutline16, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { MainPageId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ManturNavigationKey } from './locales.ts'
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
  PropsRuntime<'main.page'> & PropsLocale<'navigation.mantur'>

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

/** Render the selected marketplace as an independent, intentionally empty root page. */
export function MarketplacePage({ activePage, closePage, t }: MarketplacePageProps) {
  const copy = pageCopy[activePage]
  if (copy === undefined) throw new Error(`ui-mantur-navigation: unsupported main page "${activePage}"`)
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

/** Render Mantur's product term for the generic workspace section. */
export function ProjectsHeading({ t }: PropsLocale<'navigation.mantur'>) {
  return <>{t('projects')}</>
}

export type { ManturNavigationKey }
