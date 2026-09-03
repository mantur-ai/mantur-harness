/** ManturHub Skill marketplace Host Remote. */

import { lstat } from 'node:fs/promises'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-authorization-manturhub'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import type {
  ManturMarketplaceCatalog, ManturMarketplaceInstallResult, ManturMarketplaceSkill,
  ManturMarketplaceSkillDetail,
} from './types.ts'
import { installSkill, type InstallerConfig } from './installer.ts'

export type * from './types.ts'

/** Marketplace Host configuration. */
export interface Config {
  /** Harness home containing the live user Skill directory. */
  readonly dshHome?: string
  /** Maximum JSON bytes accepted from one ManturHub metadata response. */
  readonly maxMetadataBytes?: number
  /** Maximum compressed bytes accepted for one Skill bundle. */
  readonly maxBundleBytes?: number
  /** Maximum files accepted from one Skill archive. */
  readonly maxFiles?: number
  /** Maximum total uncompressed bytes accepted from one Skill archive. */
  readonly maxUnpackedBytes?: number
  /** Maximum bytes captured while inspecting an archive manifest. */
  readonly maxListingBytes?: number
  /** Timeout for catalog, detail, and authenticated download requests. */
  readonly metadataTimeoutMs?: number
  /** Timeout for an approved off-origin package download. */
  readonly downloadTimeoutMs?: number
}

interface ResolvedConfig extends InstallerConfig {
  readonly maxMetadataBytes: number
}

const defaultMaxMetadataBytes = 1024 * 1024
const defaultMaxBundleBytes = 100 * 1024 * 1024
const defaultMaxFiles = 20_000
const defaultMaxUnpackedBytes = 500 * 1024 * 1024
const defaultMaxListingBytes = 32 * 1024 * 1024
const defaultMetadataTimeoutMs = 30_000
const defaultDownloadTimeoutMs = 120_000
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const skillSchema = z.object({
  slug: z.string().regex(slugPattern),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  version: z.string().min(1),
  triggers: z.array(z.string()).default([]),
  uses_operators: z.array(z.string()).default([]),
  intro_md: z.string().optional().nullable(),
  assets: z.object({
    logo_url: z.url().optional().nullable(),
  }).optional().nullable(),
  kind: z.enum(['skill', 'suite']).default('skill'),
})

const skillListSchema = z.array(skillSchema)
const catalogSchema = z.union([skillListSchema, z.object({ skills: skillListSchema })])
  .transform(value => Array.isArray(value) ? value : value.skills)
const detailSchema = z.union([skillSchema, z.object({ skill: skillSchema })])
  .transform(value => 'skill' in value ? value.skill : value)

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the browser-safe ManturHub Skill marketplace. */
    manturMarketplace: ManturHubMarketplace
  }
}

/** Read a bounded JSON response without buffering an untrusted body indefinitely. */
async function responseJson(response: Response, maxBytes: number): Promise<unknown> {
  const reader = response.body?.getReader()
  if (reader === undefined) throw new Error('ManturHub returned no response body')
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    length += chunk.value.byteLength
    if (length > maxBytes) {
      await reader.cancel()
      throw new Error(`ManturHub metadata exceeded ${maxBytes} bytes`)
    }
    chunks.push(chunk.value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}

/** Return whether the exact Skill directory already exists locally. */
async function isInstalled(skillsRoot: string, slug: string): Promise<boolean> {
  try {
    await lstat(join(skillsRoot, slug))
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

/** Project server metadata and local installation state onto the browser wire. */
async function projectSkill(
  value: z.infer<typeof skillSchema>,
  skillsRoot: string,
): Promise<ManturMarketplaceSkill> {
  return {
    slug: value.slug,
    name: value.name,
    description: value.description,
    category: value.category,
    version: value.version,
    triggers: value.triggers,
    ...(value.assets?.logo_url === undefined || value.assets.logo_url === null
      ? {} : { logoUrl: value.assets.logo_url }),
    installed: await isInstalled(skillsRoot, value.slug),
  }
}

/** Host service for catalog reads and local Skill installation. */
export class ManturHubMarketplace extends TypertRemoteService {
  static inject = ['manturAccount']

  static Config: s<Config> = s.object({
    dshHome: s.string(),
    maxMetadataBytes: s.number().step(1).min(1024).default(defaultMaxMetadataBytes),
    maxBundleBytes: s.number().step(1).min(1024).default(defaultMaxBundleBytes),
    maxFiles: s.number().step(1).min(1).default(defaultMaxFiles),
    maxUnpackedBytes: s.number().step(1).min(1024).default(defaultMaxUnpackedBytes),
    maxListingBytes: s.number().step(1).min(1024).default(defaultMaxListingBytes),
    metadataTimeoutMs: s.number().step(1).min(1).default(defaultMetadataTimeoutMs),
    downloadTimeoutMs: s.number().step(1).min(1).default(defaultDownloadTimeoutMs),
  })

  private readonly config: ResolvedConfig
  private installTail: Promise<void> = Promise.resolve()

  /**
   * @param ctx - Host context carrying the ManturHub account provider.
   * @param config - storage and response limits.
   */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'manturMarketplace', { namespace: 'manturMarketplace' })
    const dshHome = resolveDshHome(config.dshHome)
    this.config = {
      dshHome,
      skillsRoot: join(dshHome, 'skills'),
      maxMetadataBytes: config.maxMetadataBytes ?? defaultMaxMetadataBytes,
      maxBundleBytes: config.maxBundleBytes ?? defaultMaxBundleBytes,
      maxFiles: config.maxFiles ?? defaultMaxFiles,
      maxUnpackedBytes: config.maxUnpackedBytes ?? defaultMaxUnpackedBytes,
      maxListingBytes: config.maxListingBytes ?? defaultMaxListingBytes,
      metadataTimeoutMs: config.metadataTimeoutMs ?? defaultMetadataTimeoutMs,
      downloadTimeoutMs: config.downloadTimeoutMs ?? defaultDownloadTimeoutMs,
    }
  }

  /**
   * Load the complete public Skill catalog and current local install flags.
   * @returns browser-safe catalog metadata.
   */
  @Remote
  async list(): Promise<ManturMarketplaceCatalog> {
    try {
      const response = await this.ctx.manturAccount.request('/api/v1/skills', {
        authenticated: false,
        headers: { 'X-ManturHub-Client': 'mantur-agent' },
        signal: AbortSignal.timeout(this.config.metadataTimeoutMs),
      })
      if (response === undefined || !response.ok) {
        throw new Error(`ManturHub catalog request failed with HTTP ${response?.status ?? 'unknown'}`)
      }
      const parsed = catalogSchema.parse(await responseJson(response, this.config.maxMetadataBytes))
      const skills = await Promise.all(parsed
        .filter(skill => skill.kind === 'skill')
        .map(skill => projectSkill(skill, this.config.skillsRoot)))
      const account = await this.ctx.manturAccount.status()
      return {
        skills,
        installedCount: skills.filter(skill => skill.installed).length,
        signedIn: account.status === 'signed-in',
      }
    } catch (error) {
      if (error instanceof RemoteError) throw error
      throw new RemoteError('gateway/internal', 'ManturHub Skill catalog could not be loaded', {}, { cause: error })
    }
  }

  /**
   * Load one public Skill's detail metadata.
   * @param slug - validated Skill slug selected in the browser.
   * @returns browser-safe Skill detail.
   */
  @Remote
  async detail(slug: string): Promise<ManturMarketplaceSkillDetail> {
    if (!slugPattern.test(slug)) {
      throw new RemoteError('gateway/bad-request', 'invalid ManturHub Skill slug', {})
    }
    try {
      const response = await this.ctx.manturAccount.request(`/api/v1/skills/${encodeURIComponent(slug)}`, {
        authenticated: false,
        headers: { 'X-ManturHub-Client': 'mantur-agent' },
        signal: AbortSignal.timeout(this.config.metadataTimeoutMs),
      })
      if (response === undefined || !response.ok) {
        throw new Error(`ManturHub Skill request failed with HTTP ${response?.status ?? 'unknown'}`)
      }
      const parsed = detailSchema.parse(await responseJson(response, this.config.maxMetadataBytes))
      if (parsed.slug !== slug) throw new Error('ManturHub returned a different Skill slug')
      return {
        ...await projectSkill(parsed, this.config.skillsRoot),
        usesOperators: parsed.uses_operators,
        ...(parsed.intro_md === undefined || parsed.intro_md === null ? {} : { introduction: parsed.intro_md }),
      }
    } catch (error) {
      if (error instanceof RemoteError) throw error
      throw new RemoteError('gateway/internal', 'ManturHub Skill detail could not be loaded', {}, { cause: error })
    }
  }

  /**
   * Download and atomically install one Skill into this running client's DSH_HOME.
   * @param slug - validated Skill slug selected in the browser.
   * @returns Host-confirmed installed version.
   */
  @Remote
  async install(slug: string): Promise<ManturMarketplaceInstallResult> {
    if (!slugPattern.test(slug)) {
      throw new RemoteError('gateway/bad-request', 'invalid ManturHub Skill slug', {})
    }
    const operation = this.installTail.then(async () => {
      const detail = await this.detail(slug)
      const installed = await installSkill(this.ctx, slug, detail.version, this.config)
      return { ...installed, installed: true as const }
    })
    this.installTail = operation.then(() => {}, () => {})
    try {
      return await operation
    } catch (error) {
      if (error instanceof RemoteError) throw error
      if ((error as Error).message === 'AUTH_REQUIRED') {
        throw new RemoteError('mantur-marketplace/auth-required', 'Sign in to ManturHub before installing Skills', {})
      }
      if ((error as Error).message === 'LOCAL_CONFLICT') {
        throw new RemoteError(
          'mantur-marketplace/local-conflict',
          'The local Skill is untracked or has been modified and will not be overwritten',
          { slug },
        )
      }
      throw new RemoteError('gateway/internal', 'ManturHub Skill could not be installed', {}, { cause: error })
    }
  }
}

export default ManturHubMarketplace
