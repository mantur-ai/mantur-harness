/** Client-safe ManturHub account and device-login types. */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Named ManturHub deployment selected for every online Mantur request. */
export type ManturEnvironment = 'production' | 'test'

/** Browser-safe deployment selection and endpoint facts. */
export interface ManturEnvironmentStatus {
  /** Active deployment. */
  readonly environment: ManturEnvironment
  /** Active HTTP(S) origin. */
  readonly baseUrl: string
  /** Configured test origin, omitted until a user supplies one. */
  readonly testBaseUrl?: string
}

/** One persistent environment-selection write from the account Settings page. */
export interface ManturEnvironmentUpdate {
  /** Deployment to activate. */
  readonly environment: ManturEnvironment
  /** Test origin to store when selecting the test deployment. */
  readonly testBaseUrl?: string
}

/** Opaque identity for one process-local ManturHub device-login attempt. */
export type ManturLoginAttemptId = Branded<'ManturLoginAttemptId'>

/** Account fields safe to show in the Mantur client. */
export interface ManturAccount {
  readonly email: string
}

/** Current durable ManturHub account state. */
export type ManturAccountStatus =
  | (ManturEnvironmentStatus & { readonly status: 'signed-out' })
  | (ManturEnvironmentStatus & { readonly status: 'signed-in'; readonly account: ManturAccount })

/** Browser-safe instructions for one device-login attempt. */
export interface ManturLoginStart {
  readonly attemptId: ManturLoginAttemptId
  readonly verificationUrl: string
  readonly userCode: string
  readonly expiresAt: number
}

/** Current process-local outcome of one device-login attempt. */
export type ManturLoginProgress =
  | { readonly status: 'pending' }
  | { readonly status: 'authorized'; readonly account: ManturAccount }
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed' }
