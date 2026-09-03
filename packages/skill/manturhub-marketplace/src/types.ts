/** Browser-safe ManturHub Skill marketplace contracts. */

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** Installing requires a current ManturHub account grant. */
    'mantur-marketplace/auth-required': {}
    /** An existing local directory is untracked or differs from its installed hash. */
    'mantur-marketplace/local-conflict': { readonly slug: string }
  }
}

/** One public Skill card returned by ManturHub. */
export interface ManturMarketplaceSkill {
  readonly slug: string
  readonly name: string
  readonly description: string
  readonly category: string
  readonly version: string
  readonly triggers: readonly string[]
  readonly logoUrl?: string
  readonly installed: boolean
}

/** Complete catalog snapshot used for reliable local search and categories. */
export interface ManturMarketplaceCatalog {
  readonly skills: readonly ManturMarketplaceSkill[]
  readonly installedCount: number
  readonly signedIn: boolean
}

/** Public Skill detail without credentials or executable bundle contents. */
export interface ManturMarketplaceSkillDetail extends ManturMarketplaceSkill {
  readonly usesOperators: readonly string[]
  readonly introduction?: string
}

/** Host-confirmed installation result. */
export interface ManturMarketplaceInstallResult {
  readonly slug: string
  readonly version: string
  readonly installed: true
}
