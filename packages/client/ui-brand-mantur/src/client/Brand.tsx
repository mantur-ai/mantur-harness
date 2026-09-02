/** Mantur text identity and collapsed-sidebar navigation affordance. */
import { IconPanelLeftOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'

/** Props shared by the two product-name occupants. */
type ManturNameProps = PropsLocale<'brand.mantur'>

/**
 * Render no invented mark in the expanded identity row and keep the collapsed
 * rail's existing navigation affordance visible.
 * @param props - Sidebar placement selected by the shell.
 * @returns the navigation icon in the rail, otherwise no mark.
 */
export function ManturSidebarMark({ placement }: SidebarBrandMarkOwnerProps) {
  return placement === 'rail' ? <IconPanelLeftOutline16 size={18} /> : null
}

/**
 * Render the full Mantur product name in the sidebar.
 * @param props - Standard locale seat.
 * @returns localized product-name text.
 */
export function ManturSidebarName({ t }: ManturNameProps) {
  return <span>{t('name')}</span>
}

/**
 * Suppress the official hero mark without repeating the sidebar product name.
 * @returns no content before the blank-session headline.
 */
export function ManturHeroBrand() {
  return null
}

/**
 * Render the Mantur blank-session headline.
 * @param props - Standard Mantur locale seat.
 * @returns the localized product promise.
 */
export function ManturHeroHeadline({ t }: ManturNameProps) {
  return <>{t('headline')}</>
}

/** @returns no preview badge in the Mantur composition. */
export function ManturHeroBadge() {
  return null
}
