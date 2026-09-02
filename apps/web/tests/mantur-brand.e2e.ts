/** Mantur desktop product identity over the real shipped Web composition. */
import { fileURLToPath } from 'node:url'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-agent-presets'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { launchWebScaffold, watchConsole, type WebScaffold } from './scaffold.ts'
import { connectFreshWorkspaceZh, saveFailureShot, ZH_BROWSER_LOCALE } from './support.ts'

const OVERLAY = fileURLToPath(new URL('../../../packages/bundle/mantur-app/cordis.patch.yml', import.meta.url))
const INSTALL_ANCHOR = fileURLToPath(new URL('../../../packages/bundle/mantur-app/package.json', import.meta.url))

describe('web e2e: Mantur product identity', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({
      extraOverlayPath: OVERLAY,
      extraInstallAnchors: [INSTALL_ANCHOR],
    })
    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: ZH_BROWSER_LOCALE })
    tripwire = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('shows the Mantur text brand without the official mark, preview badge, preset, or plan control', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-mantur-brand'))
    await expect.poll(() => page.getByText('漫途Agent', { exact: true }).count(), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(2)
    await page.getByText('故事起于一念，余下交给漫途', { exact: true }).waitFor({ timeout: 10_000 })
    expect(await page.getByText('探索未至之境', { exact: true }).count()).toBe(0)
    expect(await page.getByText('预览版', { exact: true }).count()).toBe(0)
    expect(await page.locator('[class*="fishHitbox"] svg').count()).toBe(0)
    expect(await page.getByRole('button', { name: '标准模式' }).count()).toBe(0)
    expect(await page.getByRole('button', { name: /计划模式/ }).count()).toBe(0)
    await connectFreshWorkspaceZh(page, scaffold.workspaceCwd)
    await page.getByRole('button', { name: '选择模型' }).waitFor({ timeout: 10_000 })
    await page.getByRole('button', { name: /访问模式/ }).waitFor({ timeout: 10_000 })

    await page.getByRole('button', { name: '设置', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '设置' })
    await dialog.waitFor({ timeout: 10_000 })
    expect(await dialog.getByRole('button', { name: 'Agent 预设' }).count()).toBe(0)
    await dialog.getByRole('button', { name: '模型' }).waitFor({ timeout: 10_000 })
    await dialog.getByRole('button', { name: '关闭' }).click()
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it('gives a new agent the Mantur persona without generic Harness or Web GUI identity sections', async () => {
    const handle = await scaffold.ctx.agents.create({
      sessionId: SessionId('mantur-brand-identity'),
      meta: { cwd: scaffold.workspaceCwd },
      setup: agentCtx => scaffold.ctx.agentPresets.mount(agentCtx).then(() => undefined),
    })
    try {
      const assembly = await scaffold.ctx.systemPrompt.assemble({ scope: handle.agent })
      expect(assembly.sections.find(section => section.name === 'deployment:persona')?.text)
        .toContain('你是漫途Agent，由漫途（Mantur）打造')
      expect(assembly.sections.some(section => section.name === 'harness:identity')).toBe(false)
      expect(assembly.sections.some(section => section.name === 'harness:source')).toBe(false)
      expect(assembly.sections.some(section => section.name === 'app:web-surface')).toBe(false)
    } finally {
      await handle.dispose()
    }
  })
})
