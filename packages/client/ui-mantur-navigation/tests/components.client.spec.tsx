// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import {
  MANTUR_MARKET_PAGES, MarketplaceNavigation, MarketplacePage,
  ProjectsHeading,
} from '../src/client/MarketplaceNavigation.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh)
const globalProps = {
  useSessions: vi.fn() as never,
  useSessionPendingInteraction: vi.fn() as never,
  useWorkspaces: vi.fn() as never,
}

describe('Mantur marketplace navigation', () => {
  it('renders Features before the two fixed entries and opens the selected page', () => {
    const openPage = vi.fn()
    const { rerender } = render(
      <MarketplaceNavigation
        {...globalProps}
        wide activePage={undefined} openPage={openPage} closePage={vi.fn()} t={t}
      />,
    )
    expect(screen.getByRole('navigation', { name: '功能' })).toBeTruthy()
    const buttons = screen.getAllByRole('button')
    expect(buttons.map(button => button.textContent)).toEqual(['技能广场', '配方广场'])

    fireEvent.click(screen.getByRole('button', { name: '技能广场' }))
    expect(openPage).toHaveBeenCalledWith(MANTUR_MARKET_PAGES.skills)

    rerender(
      <MarketplaceNavigation
        {...globalProps}
        wide activePage={MANTUR_MARKET_PAGES.skills} openPage={openPage} closePage={vi.fn()} t={t}
      />,
    )
    expect(screen.getByRole('button', { name: '技能广场' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: '配方广场' }).hasAttribute('aria-current')).toBe(false)
  })

  it('renders independent Skill and Recipe pages and returns to conversation', () => {
    const closePage = vi.fn()
    const view = render(
      <MarketplacePage
        {...globalProps}
        activePage={MANTUR_MARKET_PAGES.skills} closePage={closePage} t={t}
      />,
    )
    expect(screen.getByRole('heading', { name: '技能广场' })).toBeTruthy()
    expect(screen.getByText('技能正在陆续上架，稍后从这里探索。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '返回对话' }))
    expect(closePage).toHaveBeenCalledOnce()

    view.rerender(
      <MarketplacePage
        {...globalProps}
        activePage={MANTUR_MARKET_PAGES.recipes} closePage={closePage} t={t}
      />,
    )
    expect(screen.getByRole('heading', { name: '配方广场' })).toBeTruthy()
    expect(screen.getByText('配方正在准备中，稍后从这里开始创作。')).toBeTruthy()
  })

  it('keeps the two destinations available in the compact rail', () => {
    const openPage = vi.fn()
    render(
      <MarketplaceNavigation
        {...globalProps}
        wide={false}
        activePage={MANTUR_MARKET_PAGES.recipes}
        openPage={openPage}
        closePage={vi.fn()}
        t={t}
      />,
    )
    expect(screen.getByRole('button', { name: '配方广场' }).getAttribute('aria-current')).toBe('page')
    fireEvent.click(screen.getByRole('button', { name: '配方广场' }))
    expect(openPage).toHaveBeenCalledWith(MANTUR_MARKET_PAGES.recipes)
  })

  it('renders the product workspace term and rejects a page owned by another product', () => {
    render(<ProjectsHeading t={t} />)
    expect(screen.getByText('项目')).toBeTruthy()
    cleanup()
    expect(() => MarketplacePage({
      ...globalProps,
      activePage: 'other.page' as never,
      closePage: vi.fn(),
      t,
    })).toThrow(/unsupported main page/)
  })
})
