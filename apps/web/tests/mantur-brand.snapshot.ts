/** Mantur desktop product identity over the real shipped Web composition. */
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import type {} from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import { formatSystemPromptSnapshot, formatToolSchemasSnapshot } from '@deepseek-ai/dsh-session-snapshot'
import type {} from '@deepseek-ai/dsh-agent-presets'
import type {} from '@deepseek-ai/dsh-system-prompt'
import {
  captureStableAria, compareOrRefreshGolden, fixtureUserPrompts, launchWebScaffold, watchConsole, webSnapshotMode,
  type WebScaffold,
} from './scaffold.ts'
import {
  connectFreshWorkspace, connectFreshWorkspaceZh, newEnglishPage, saveFailureShot, ZH_BROWSER_LOCALE,
} from './support.ts'

const OVERLAY = fileURLToPath(new URL('../../../packages/bundle/mantur-app/cordis.patch.yml', import.meta.url))
const INSTALL_ANCHOR = fileURLToPath(new URL('../../../packages/bundle/mantur-app/package.json', import.meta.url))
const SNAPSHOT_DIR = fileURLToPath(new URL('../../../snapshots/web/mantur-brand', import.meta.url))
const FIXTURE = fileURLToPath(new URL('../../../snapshots/web/fresh-round-trip/session.jsonl', import.meta.url))
const SYSTEM_PROMPT_EXPECTED = join(SNAPSHOT_DIR, 'system-prompt.expected.md')
const TOOL_SCHEMAS_EXPECTED = fileURLToPath(
  new URL('../../../snapshots/web/fresh-round-trip/tool-schemas.expected.json', import.meta.url),
)
const MARKETPLACE_EXPECTED = join(SNAPSHOT_DIR, 'marketplace.expected.md')
const MODE = webSnapshotMode()

const marketplaceSkill = {
  slug: 'story-director',
  name: '故事导演',
  description: '把完整剧本整理成可执行的漫剧制作方案。',
  category: '漫剧创作',
  version: '1.2.3',
  triggers: ['做漫剧', '拆分镜'],
  uses_operators: ['seedance-video'],
  intro_md: '从剧本分析开始，自动组织角色、场景和分镜。',
  assets: null,
  kind: 'skill',
}

/** Start a local ManturHub protocol fixture used by the real Host and Remote layers. */
async function startManturHubFixture(): Promise<{
  readonly baseUrl: string
  readonly requests: string[]
  readonly server: Server
  authorize(): void
}> {
  let authorized = false
  const requests: string[] = []
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    requests.push(`${request.method ?? 'UNKNOWN'} ${url.pathname}`)
    const json = (status: number, value: unknown): void => {
      response.writeHead(status, { 'content-type': 'application/json' })
      response.end(JSON.stringify(value))
    }
    if (request.method === 'GET' && url.pathname === '/api/v1/skills') {
      json(200, { skills: [marketplaceSkill] })
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/v1/skills/story-director') {
      json(200, { skill: marketplaceSkill })
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/v1/cli/session') {
      const address = server.address() as AddressInfo
      json(200, {
        device_code: 'device-test',
        user_code: 'MANTUR-1234',
        verify_url: `http://127.0.0.1:${address.port}/verify`,
        interval: 1,
        expires_in: 60,
      })
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/v1/cli/poll') {
      json(200, authorized ? { status: 'ready', key: 'fixture-grant' } : { status: 'pending' })
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/v1/me') {
      if (request.headers['x-api-key'] !== 'fixture-grant') {
        json(401, { error: 'missing fixture grant' })
        return
      }
      json(200, { email: 'artist@example.com' })
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/v1/skills/story-director/download') {
      if (request.headers['x-api-key'] !== 'fixture-grant') {
        json(401, { error: 'missing fixture grant' })
        return
      }
      response.writeHead(500, { 'content-type': 'application/zip' })
      response.end('deterministic invalid bundle')
      return
    }
    json(404, { error: 'unknown fixture route' })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    server,
    authorize: () => { authorized = true },
  }
}

describe.skipIf(MODE === 'record')('web snapshot: Mantur product identity', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>
  let manturHub: Awaited<ReturnType<typeof startManturHubFixture>> | undefined

  beforeAll(async () => {
    const fixture = await startManturHubFixture()
    manturHub = fixture
    scaffold = await launchWebScaffold({
      extraOverlayPath: OVERLAY,
      extraInstallAnchors: [INSTALL_ANCHOR],
      manturHubBaseUrl: fixture.baseUrl,
      compareReplaySession: false,
      replayFixture: FIXTURE,
    })
    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: ZH_BROWSER_LOCALE })
    tripwire = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 }).catch(async () => {
      throw new Error(`Mantur Web frame did not mount. Body: ${await page.locator('body').innerText()}. Page errors: ${tripwire.pageErrors.map(String).join('; ')}`)
    })
    await page.getByRole('heading', { name: '登录漫途账号' }).waitFor({ timeout: 10_000 })
    await page.getByRole('button', { name: '暂时跳过' }).click()
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
    if (manturHub !== undefined) {
      const hub = manturHub
      await new Promise<void>((resolve, reject) => hub.server.close((error) => {
        if (error === undefined) resolve()
        else reject(error)
      }))
    }
  })

  it('shows the Mantur brand without the official mark, preview badge, preset, or plan control', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-mantur-brand'))
    await expect.poll(() => page.getByText('漫途Agent', { exact: true }).count(), { timeout: 10_000 })
      .toBe(1)
    await page.getByText('故事起于一念，余下交给漫途', { exact: true }).waitFor({ timeout: 10_000 })
    expect(await page.getByText('探索未至之境', { exact: true }).count()).toBe(0)
    expect(await page.getByText('预览版', { exact: true }).count()).toBe(0)
    expect(await page.getByText('内测声明', { exact: true }).count()).toBe(0)
    expect(await page.getByText('添加一个 API Key 开始使用', { exact: true }).count()).toBe(0)
    expect(await page.getByText(/DeepSeek Harness/).count()).toBe(0)
    expect(await page.locator('[class*="fishHitbox"] svg').count()).toBe(0)
    expect(await page.locator('img[src$="mantur-logo.png"]').count()).toBe(2)
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

  it('orders Mantur account choice before DeepSeek credential onboarding', async () => {
    const firstRun = await launchWebScaffold({
      extraOverlayPath: OVERLAY,
      extraInstallAnchors: [INSTALL_ANCHOR],
      deepSeekMissingCredential: true,
    })
    const firstRunPage = await browser.newPage({
      viewport: { width: 1680, height: 1000 },
      locale: ZH_BROWSER_LOCALE,
    })
    try {
      await firstRunPage.goto(firstRun.authenticatedUrl, { waitUntil: 'load' })
      await firstRunPage.waitForSelector('[class*="frame"]', { timeout: 30_000 })
      await firstRunPage.getByRole('heading', { name: '登录漫途账号' }).waitFor({ timeout: 10_000 })
      expect(await firstRunPage.getByText('内测声明', { exact: true }).count()).toBe(0)
      expect(await firstRunPage.getByText('添加一个 API Key 开始使用', { exact: true }).count()).toBe(0)
      await firstRunPage.getByRole('button', { name: '暂时跳过' }).click()
      await firstRunPage.getByRole('heading', { name: '添加一个 API Key 开始使用' })
        .waitFor({ timeout: 10_000 })
    } finally {
      await firstRunPage.close()
      await firstRun.close()
    }
  }, 60_000)

  it('renders the assembled catalog, detail, login gate, and installation failure', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-mantur-market-navigation'))
    await page.getByText('项目', { exact: true }).waitFor({ timeout: 10_000 })
    expect(await page.getByText('工作区', { exact: true }).count()).toBe(0)
    await page.getByRole('navigation', { name: '功能' }).waitFor({ timeout: 10_000 })

    const skills = page.getByRole('button', { name: '技能广场' })
    await skills.click()
    await page.getByRole('heading', { name: '技能广场' }).waitFor({ timeout: 10_000 })
    expect(await skills.getAttribute('aria-current')).toBe('page')
    await expect(scaffold.ctx.manturMarketplace.list()).resolves.toMatchObject({
      skills: [{ slug: 'story-director' }],
      signedIn: false,
    })
    await page.getByText('故事导演', { exact: true }).waitFor({ timeout: 10_000 }).catch(async () => {
      throw new Error(`Mantur marketplace catalog did not render. Requests: ${manturHub?.requests.join(', ') ?? 'fixture unavailable'}. Page errors: ${tripwire.pageErrors.map(String).join('; ')}. Main: ${await page.locator('main').innerText()}`)
    })
    const catalog = await captureStableAria(page, 'main', scaffold.workspaceCwd)
    await page.getByText('故事导演', { exact: true }).click()
    await page.getByRole('dialog', { name: '故事导演' }).waitFor({ timeout: 10_000 })
    await page.getByText('版本 1.2.3', { exact: true }).waitFor({ timeout: 10_000 })
    const detail = await captureStableAria(page, '[role="dialog"]', scaffold.workspaceCwd)
    expect(detail).toContain('版本 1.2.3')

    await page.getByRole('button', { name: '登录后安装' }).click()
    await page.getByText('MANTUR-1234', { exact: true }).waitFor({ timeout: 10_000 }).catch(async () => {
      throw new Error(`Mantur marketplace login did not start. Requests: ${manturHub?.requests.join(', ') ?? 'fixture unavailable'}. Page errors: ${tripwire.pageErrors.map(String).join('; ')}. Main: ${await page.locator('main').innerText()}`)
    })
    if (manturHub === undefined) throw new Error('ManturHub fixture did not start')
    const loginGate = (await captureStableAria(page, '[role="dialog"]', scaffold.workspaceCwd))
      .split(manturHub.baseUrl).join('{{manturHubUrl}}')
    expect(loginGate).toContain('MANTUR-1234')
    manturHub.authorize()
    const detailInstall = page.getByRole('dialog', { name: '故事导演' }).getByRole('button', { name: '安装技能' })
    await detailInstall.waitFor({ timeout: 10_000 })
    await detailInstall.click()
    await page.getByRole('alert').filter({ hasText: '技能安装失败' }).waitFor({ timeout: 10_000 })
    const installFailure = await captureStableAria(page, '[role="dialog"]', scaffold.workspaceCwd)
    expect(installFailure).toContain('alert')
    expect(installFailure).toContain('技能安装失败')
    await compareOrRefreshGolden(
      MARKETPLACE_EXPECTED,
      [`## Catalog\n\n${catalog}`, `## Detail\n\n${detail}`, `## Login gate\n\n${loginGate}`, `## Install failure\n\n${installFailure}`].join('\n\n'),
      MODE,
    )

    await page.getByRole('button', { name: '关闭', exact: true }).click()

    await page.getByRole('button', { name: '配方广场' }).click()
    await page.getByRole('heading', { name: '配方广场' }).waitFor({ timeout: 10_000 })
    await page.getByText('从经过验证的优秀案例出发，替换成你的内容，让漫途复刻同款效果。')
      .waitFor({ timeout: 10_000 })
    await page.getByText(/配方本身免费；使用配方复刻时按算子实时报价，并在开始前请你确认/)
      .waitFor({ timeout: 10_000 })
    expect(await page.getByRole('button', { name: '配方广场' }).getAttribute('aria-current')).toBe('page')

    await page.getByRole('button', { name: '返回对话' }).click()
    await page.getByText('故事起于一念，余下交给漫途', { exact: true }).waitFor({ timeout: 10_000 })
    expect(await page.getByRole('heading', { name: '配方广场' }).count()).toBe(0)
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it('renders the English Mantur surface while retaining model and permission selection', async () => {
    const englishScaffold = await launchWebScaffold({
      extraOverlayPath: OVERLAY,
      extraInstallAnchors: [INSTALL_ANCHOR],
    })
    const englishPage = await newEnglishPage(browser)
    const englishTripwire = watchConsole(englishPage)
    try {
      await englishPage.goto(englishScaffold.authenticatedUrl, { waitUntil: 'load' })
      await englishPage.waitForSelector('[class*="frame"]', { timeout: 30_000 })
      await englishPage.getByRole('heading', { name: 'Sign in to Mantur' }).waitFor({ timeout: 10_000 })
      await englishPage.getByRole('button', { name: 'Not now' }).click()
      await englishPage.getByText('漫途Agent', { exact: true }).waitFor({ timeout: 10_000 })
      await englishPage.getByText('Every story starts with an idea. Mantur handles the rest.', { exact: true })
        .waitFor({ timeout: 10_000 })
      expect(await englishPage.getByText('Preview', { exact: true }).count()).toBe(0)
      expect(await englishPage.getByText('Internal Testing Notice', { exact: true }).count()).toBe(0)
      expect(await englishPage.getByText('Add an API key to get started', { exact: true }).count()).toBe(0)
      expect(await englishPage.getByText(/DeepSeek Harness/).count()).toBe(0)
      expect(await englishPage.getByRole('button', { name: 'Standard mode' }).count()).toBe(0)
      expect(await englishPage.getByRole('button', { name: /Plan mode/ }).count()).toBe(0)
      await connectFreshWorkspace(englishPage, englishScaffold.workspaceCwd, 'workspace-en')
      await englishPage.getByRole('button', { name: 'Select model' }).waitFor({ timeout: 10_000 })
      await englishPage.getByRole('button', { name: /Access mode/ }).waitFor({ timeout: 10_000 })
      expect(englishTripwire.pageErrors).toEqual([])
    } finally {
      await englishPage.close()
      await englishScaffold.close()
    }
  }, 60_000)

  it('replays a recorded turn with only the Mantur product identity in its request', async () => {
    const handle = await scaffold.ctx.agents.create({
      sessionId: SessionId('mantur-brand-snapshot'),
      meta: { cwd: scaffold.workspaceCwd },
      agentOptions: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
      setup: agentCtx => scaffold.ctx.agentPresets.mount(agentCtx).then(() => undefined),
    })
    try {
      const assembly = await scaffold.ctx.systemPrompt.assemble({ scope: handle.agent })
      expect(assembly.sections.find(section => section.name === 'deployment:persona')?.text)
        .toContain('你是漫途Agent，由漫途（Mantur）打造')
      expect(assembly.sections.some(section => section.name === 'harness:identity')).toBe(false)
      expect(assembly.sections.some(section => section.name === 'harness:source')).toBe(false)
      expect(assembly.sections.some(section => section.name === 'app:web-surface')).toBe(false)
      const prompts = fixtureUserPrompts(await readFile(FIXTURE, 'utf8'))
      expect(prompts).toHaveLength(1)
      const prompt = prompts[0]
      if (prompt === undefined) throw new Error('the Mantur fixture contains no user prompt')
      handle.agent.followup(createUserMessage({
        content: [{ type: 'text', text: prompt }],
        source: { kind: 'user' },
      }))
      await handle.agent.whenIdle()
      const header = handle.agent.session.requestHeader()
      if (header === undefined) throw new Error('the Mantur replay issued no model request')
      if (header.system === undefined) throw new Error('the Mantur replay request has no system prompt')
      const promptSnapshot = formatSystemPromptSnapshot(
        header.system.split(scaffold.workspaceCwd).join('{{cwd}}'),
      )
      await compareOrRefreshGolden(SYSTEM_PROMPT_EXPECTED, promptSnapshot.trimEnd(), MODE)
      await compareOrRefreshGolden(
        TOOL_SCHEMAS_EXPECTED,
        formatToolSchemasSnapshot(header.tools ?? []).trimEnd(),
        'replay',
      )
    } finally {
      await handle.dispose()
    }
  })
})
