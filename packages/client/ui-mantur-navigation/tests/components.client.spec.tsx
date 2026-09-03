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
    expect(screen.getByText('从经过验证的优秀案例出发，替换成你的内容，让漫途复刻同款效果。')).toBeTruthy()
    expect(screen.getByText('每份配方包含效果样片、提示词模板、可复现算子参数、模型与算子信息和预计复刻成本。配方本身免费；使用配方复刻时按算子实时报价，并在开始前请你确认。')).toBeTruthy()
  })

  it('returns to conversation when the active marketplace occupant unloads', () => {
    const closePage = vi.fn()
    const view = render(
      <MarketplacePage
        {...globalProps}
        activePage={MANTUR_MARKET_PAGES.skills}
        closePage={closePage}
        t={t}
      />,
    )

    view.unmount()
    expect(closePage).toHaveBeenCalledOnce()
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
    expect(() => render(
      <MarketplacePage
        {...globalProps}
        activePage={'other.page' as never}
        closePage={vi.fn()}
        t={t}
      />,
    )).toThrow(/unsupported main page/)
  })
})
