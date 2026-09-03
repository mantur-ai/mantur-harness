// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import {
  MANTUR_MARKET_PAGES, MarketplaceNavigation, MarketplacePage,
  ProjectsHeading,
} from '../src/client/MarketplaceNavigation.tsx'
import { zh } from '../src/client/locales.ts'
import type { ManturMarketplaceState, ManturMarketplaceStore } from '../src/client/store.ts'

afterEach(cleanup)

const t = makeTranslate(zh)
const globalProps = {
  useSessions: vi.fn() as never,
  useSessionPendingInteraction: vi.fn() as never,
  useWorkspaces: vi.fn() as never,
}

const emptyReady: ManturMarketplaceState = {
  phase: 'ready',
  catalog: { skills: [], installedCount: 0, signedIn: false },
}

type ControllerMocks = {
  [K in 'load' | 'openDetail' | 'closeDetail' | 'install' | 'startLogin' | 'cancelLogin']: ReturnType<typeof vi.fn>
}

function marketplaceProps(state: ManturMarketplaceState = emptyReady) {
  const controller = {
    load: vi.fn(),
    openDetail: vi.fn(),
    closeDetail: vi.fn(),
    install: vi.fn(),
    startLogin: vi.fn(),
    cancelLogin: vi.fn(),
  } satisfies ControllerMocks
  return {
    controller: controller as unknown as ManturMarketplaceStore,
    controllerMocks: controller,
    useMarketplace: ((selector: (value: ManturMarketplaceState) => unknown) => selector(state)) as never,
  }
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
        {...marketplaceProps()}
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
        {...marketplaceProps()}
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
        {...marketplaceProps()}
        activePage={MANTUR_MARKET_PAGES.skills}
        closePage={closePage}
        t={t}
      />,
    )

    view.unmount()
    expect(closePage).toHaveBeenCalledOnce()
  })

  it('shows loading and retryable catalog failures', () => {
    const loadingProps = marketplaceProps({ phase: 'idle' })
    const closePage = vi.fn()
    const view = render(
      <MarketplacePage
        {...globalProps}
        {...loadingProps}
        activePage={MANTUR_MARKET_PAGES.skills}
        closePage={closePage}
        t={t}
      />,
    )
    expect(screen.getByText('正在连接 ManturHub…')).toBeTruthy()
    expect(loadingProps.controllerMocks.load).toHaveBeenCalledOnce()

    const failedProps = marketplaceProps({ phase: 'failed' })
    view.rerender(
      <MarketplacePage
        {...globalProps}
        {...failedProps}
        activePage={MANTUR_MARKET_PAGES.skills}
        closePage={closePage}
        t={t}
      />,
    )
    expect(screen.getByText('技能列表加载失败，请检查网络后重试。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }))
    expect(failedProps.controllerMocks.load).toHaveBeenCalledOnce()
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
        {...marketplaceProps()}
        activePage={'other.page' as never}
        closePage={vi.fn()}
        t={t}
      />,
    )).toThrow(/unsupported main page/)
  })

  it('installs directly when signed in and presents the device login gate when signed out', () => {
    const listed = {
      slug: 'story-director',
      name: '故事导演',
      description: '把故事变成分镜',
      category: '剧本创作',
      version: '1.2.3',
      triggers: ['写分镜'],
      installed: false,
    }
    const signedIn: ManturMarketplaceState = {
      phase: 'ready',
      catalog: { skills: [listed], installedCount: 0, signedIn: true },
    }
    const signedInProps = marketplaceProps(signedIn)
    const closePage = vi.fn()
    const view = render(
      <MarketplacePage
        {...globalProps}
        {...signedInProps}
        activePage={MANTUR_MARKET_PAGES.skills}
        closePage={closePage}
        t={t}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '安装技能' }))
    expect(signedInProps.controllerMocks.install).toHaveBeenCalledWith('story-director')

    const installingProps = marketplaceProps({
      ...signedIn, installing: listed.slug, detail: { ...listed, usesOperators: [] },
    })
    view.rerender(
      <MarketplacePage
        {...globalProps}
        {...installingProps}
        activePage={MANTUR_MARKET_PAGES.skills}
        closePage={closePage}
        t={t}
      />,
    )
    expect(screen.getAllByRole('button', { name: '正在安装…' }).every(button => button.hasAttribute('disabled')))
      .toBe(true)

    const preparingProps = marketplaceProps({
      phase: 'ready',
      catalog: { skills: [listed], installedCount: 0, signedIn: false },
      detail: { ...listed, usesOperators: [] },
      loginPhase: 'starting',
    })
    view.rerender(
      <MarketplacePage
        {...globalProps} {...preparingProps} activePage={MANTUR_MARKET_PAGES.skills} closePage={closePage} t={t}
      />,
    )
    expect(screen.getByRole('button', { name: '正在准备登录…' }).hasAttribute('disabled')).toBe(true)

    const installed = { ...listed, installed: true }
    const installedProps = marketplaceProps({
      phase: 'ready',
      catalog: { skills: [installed], installedCount: 1, signedIn: true },
    })
    view.rerender(
      <MarketplacePage
        {...globalProps}
        {...installedProps}
        activePage={MANTUR_MARKET_PAGES.skills}
        closePage={closePage}
        t={t}
      />,
    )
    expect(screen.getByRole('button', { name: '已安装' }).hasAttribute('disabled')).toBe(true)

    const signedOut: ManturMarketplaceState = {
      phase: 'ready',
      catalog: { skills: [listed], installedCount: 0, signedIn: false },
      detail: { ...listed, usesOperators: [] },
    }
    const signedOutProps = marketplaceProps(signedOut)
    view.rerender(
      <MarketplacePage
        {...globalProps}
        {...signedOutProps}
        activePage={MANTUR_MARKET_PAGES.skills}
        closePage={closePage}
        t={t}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '登录后安装' }))
    expect(signedOutProps.controllerMocks.startLogin).toHaveBeenCalledOnce()
  })

  it('filters the catalog, opens details, and presents detail outcomes', () => {
    const story = {
      slug: 'story-director', name: '故事导演', description: '把故事变成分镜', category: '剧本创作',
      version: '1.2.3', triggers: ['写分镜'], installed: false,
    }
    const art = {
      slug: 'art-maker', name: '画面生成', description: '生成角色图片', category: '视觉素材',
      version: '2.0.0', triggers: ['画角色'], installed: false,
    }
    const base = { phase: 'ready' as const, catalog: { skills: [story, art], installedCount: 0, signedIn: true } }
    const props = marketplaceProps(base)
    const view = render(
      <MarketplacePage
        {...globalProps} {...props} activePage={MANTUR_MARKET_PAGES.skills} closePage={vi.fn()} t={t}
      />,
    )

    const search = screen.getByPlaceholderText('搜索技能名称、用途或触发词')
    fireEvent.change(search, { target: { value: '角色' } })
    expect(screen.queryByText('故事导演')).toBeNull()
    expect(screen.getByText('画面生成')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '视觉素材' }))
    fireEvent.click(screen.getByRole('button', { name: '全部' }))
    fireEvent.change(search, { target: { value: '不存在' } })
    expect(screen.getByText('没有找到匹配的技能。')).toBeTruthy()

    fireEvent.change(search, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /故事导演/ }))
    expect(props.controllerMocks.openDetail).toHaveBeenCalledWith(story.slug)

    const detailProps = marketplaceProps({
      ...base,
      detail: { ...story, usesOperators: ['op.text'], introduction: '使用说明' },
      installError: 'local-conflict',
    })
    view.rerender(
      <MarketplacePage
        {...globalProps} {...detailProps} activePage={MANTUR_MARKET_PAGES.skills} closePage={vi.fn()} t={t}
      />,
    )
    expect(screen.getByText('使用说明')).toBeTruthy()
    expect(screen.getByText(/本地已有同名技能/)).toBeTruthy()
    const installButtons = screen.getAllByRole('button', { name: '安装技能' })
    fireEvent.click(installButtons[installButtons.length - 1] as HTMLElement)
    expect(detailProps.controllerMocks.install).toHaveBeenCalledWith(story.slug)

    const failedProps = marketplaceProps({ ...base, detail: { ...story, usesOperators: [] }, installError: 'failed', loginPhase: 'failed' })
    view.rerender(
      <MarketplacePage
        {...globalProps} {...failedProps} activePage={MANTUR_MARKET_PAGES.skills} closePage={vi.fn()} t={t}
      />,
    )
    expect(screen.getByText('技能安装失败，原有文件没有被覆盖。请稍后重试。')).toBeTruthy()
    expect(screen.getByText('ManturHub 登录没有完成，请重试。')).toBeTruthy()

    const loginProps = marketplaceProps({
      ...base,
      catalog: { ...base.catalog, signedIn: false },
      detail: { ...story, usesOperators: [] },
      loginPhase: 'authorizing',
      login: {
        attemptId: 'attempt' as never,
        verificationUrl: 'https://hub.mantur.ai/device',
        userCode: 'MANT-1234',
        expiresAt: Date.now() + 60_000,
      },
    })
    view.rerender(
      <MarketplacePage
        {...globalProps} {...loginProps} activePage={MANTUR_MARKET_PAGES.skills} closePage={vi.fn()} t={t}
      />,
    )
    expect(screen.getByText('MANT-1234')).toBeTruthy()
    expect(screen.getByRole('link', { name: '打开 ManturHub 登录页' }).getAttribute('href')).toBe('https://hub.mantur.ai/device')
    fireEvent.click(screen.getByRole('button', { name: '取消登录' }))
    expect(loginProps.controllerMocks.cancelLogin).toHaveBeenCalledOnce()
  })

  it('opens signed-out cards, closes loading details, and renders an installed detail', () => {
    const installed = {
      slug: 'story-director', name: '故事导演', description: '把故事变成分镜', category: '剧本创作',
      version: '1.2.3', triggers: [], installed: true,
    }
    const loadingProps = marketplaceProps({
      phase: 'ready', catalog: { skills: [{ ...installed, installed: false }], installedCount: 0, signedIn: false },
      detailLoading: installed.slug,
    })
    const view = render(
      <MarketplacePage
        {...globalProps} {...loadingProps} activePage={MANTUR_MARKET_PAGES.skills} closePage={vi.fn()} t={t}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '查看' }))
    expect(loadingProps.controllerMocks.openDetail).toHaveBeenCalledWith(installed.slug)
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(loadingProps.controllerMocks.closeDetail).toHaveBeenCalledOnce()

    const installedProps = marketplaceProps({
      phase: 'ready', catalog: { skills: [installed], installedCount: 1, signedIn: true },
      detail: { ...installed, usesOperators: [] },
    })
    view.rerender(
      <MarketplacePage
        {...globalProps} {...installedProps} activePage={MANTUR_MARKET_PAGES.skills} closePage={vi.fn()} t={t}
      />,
    )
    expect(screen.getAllByRole('button', { name: '已安装' }).every(button => button.hasAttribute('disabled'))).toBe(true)
  })
})
