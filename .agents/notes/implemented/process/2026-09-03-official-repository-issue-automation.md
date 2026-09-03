# Agent Note: Official-repository Issue automation

Status: implemented

English | [中文](2026-09-03-official-repository-issue-automation.zh.md)

## Problem

GitHub copies the Issue policy and Issue lifecycle workflows into every fork. Their configuration and credentials belong to `deepseek-harness/deepseek-harness`: pull-request policy queries use official-repository Issue and pull-request numbers, while lifecycle mutations require the official organization App. A fork therefore cannot execute either workflow correctly, and substituting the fork repository would silently change which policy and Project receive mutations.

## Decision

Both workflow jobs remain subscribed to their existing events without a job-level condition. When `github.repository` is not `deepseek-harness/deepseek-harness`, each job runs one named no-op step and succeeds. Checkout and policy execution run only for the official repository. The lifecycle App-token and handler steps additionally retain their review-event condition, so approved and commented reviews do not mint a write-capable token.

The Issue-management configuration continues to name the official organization and repository. Forks do not receive a dynamic repository substitution or credential fallback.

## Verification

[Workflow tests](../../../../scripts/ci-workflow.spec.ts) parse both YAML files and require the explicit fork no-op, the official-repository condition on checkout and execution, and the combined repository/event condition on lifecycle token creation and mutation.

## Alternatives considered

**Rewrite the Issue-management configuration for each fork.** A repository name alone does not provide the matching Project, labels, App installation, or policy ownership, so this would create a plausible but incomplete automation target.

**Select `github.repository` dynamically.** This removes the immediate 404 but silently turns an official governance workflow into fork-owned policy and can send mutations to a Project that was never configured for that fork.

**Skip the complete job or delete the workflows in forks.** A job-level skip produces a gray check and deleting upstream files increases merge drift. An explicit successful step keeps the inherited workflow visible and explains why it performed no action.

## Consequences

Fork pull requests keep successful Issue policy and Issue lifecycle jobs without checking out trusted policy code, reading official App credentials, calling official pull-request endpoints, or mutating the official Project. The official repository retains its existing validation and lifecycle behavior. A fork that needs its own Issue automation must define and verify that ownership explicitly instead of inheriting a fallback.
