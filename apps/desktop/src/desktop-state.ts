/** Application-owned paths and explicit recovery for disposable desktop state. */

import { mkdir, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'

/** Stable directory name below Electron's per-user application-data root. */
export const DESKTOP_USER_DATA_NAME = 'mantur-agent'

/** Development directory name kept separate from installed application data. */
export const DESKTOP_DEVELOPMENT_USER_DATA_NAME = 'mantur-agent-dev'

/** Desktop execution mode that selects the owned user-data directory. */
export type DesktopMode = 'development' | 'release'

/** Files and directories owned by one installed desktop application. */
export interface DesktopPaths {
  /** Stable Electron user-data directory across application upgrades. */
  userData: string
  /** Harness home isolated from ambient CLI and development installations. */
  dshHome: string
  /** Neutral child-process working directory. */
  launchRoot: string
  /** Persistent desktop and Harness diagnostic log. */
  logPath: string
}

/** Resolve the mode-specific desktop user-data directory below an operating-system app-data root. */
export function desktopUserDataPath(appData: string, mode: DesktopMode = 'release'): string {
  const name = mode === 'development' ? DESKTOP_DEVELOPMENT_USER_DATA_NAME : DESKTOP_USER_DATA_NAME
  return join(appData, name)
}

/** Resolve every desktop-owned path from Electron's configured user-data directory. */
export function desktopPaths(userData: string): DesktopPaths {
  return {
    userData,
    dshHome: join(userData, 'harness'),
    launchRoot: join(userData, 'launch-root'),
    logPath: join(userData, 'logs', 'harness.log'),
  }
}

/** Materialize the directories required before the Harness process starts. */
export async function prepareDesktopPaths(paths: DesktopPaths): Promise<void> {
  await Promise.all([
    mkdir(paths.dshHome, { recursive: true }),
    mkdir(paths.launchRoot, { recursive: true }),
    mkdir(dirname(paths.logPath), { recursive: true }),
  ])
}

/** Whether one startup failure names the disposable session-projection cache. */
export function canResetProjectionCache(error: unknown): boolean {
  const detail = error instanceof Error ? error.message : String(error)
  return detail.includes("domain 'session_projcache'")
    && detail.includes('does not match its schema')
}

/**
 * Remove only the application-owned projection cache after explicit user approval.
 * Session logs, settings, credentials, profiles, and workspaces stay untouched.
 */
export async function resetProjectionCache(dshHome: string): Promise<void> {
  const root = resolve(dshHome)
  if (basename(root) !== 'harness') {
    throw new Error(`refusing to reset projection cache outside a desktop Harness home: ${root}`)
  }
  const storageRoot = join(root, 'storages')
  await Promise.all([
    rm(join(storageRoot, 'session_projcache'), { recursive: true, force: true }),
    rm(join(storageRoot, 'session_projcache.json'), { force: true }),
  ])
}
