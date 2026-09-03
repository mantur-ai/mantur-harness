# Agent Note: Fork-isolated Issue automation

Status: implemented

English | [中文](2026-09-03-fork-isolated-issue-automation.zh.md)

## Problem

GitHub copies the Issue policy and Issue lifecycle workflows into every fork. Pull-request and Issue numbers in a fork do not identify the same objects in its parent, and the lifecycle workflow depends on repository-owned App credentials and Project configuration. Running inherited automation in a fork can therefore fail or target governance state that the fork does not own.

## Decision

Both workflow jobs remain subscribed to their existing events without a job-level condition. When `github.event.repository.fork` is `true`, each job runs one named no-op step and succeeds. When it is `false`, checkout and policy execution retain their existing behavior. The lifecycle App-token and handler steps additionally retain their review-event condition, so approved and commented reviews do not mint a write-capable token.

The condition uses GitHub's repository `fork` fact instead of a repository slug, so a non-fork repository keeps its existing execution path across transfers or renames. The Issue-management configuration is unchanged; its organization, repository, App installation, and Project ownership remain separate non-fork concerns rather than a fallback supplied by these workflows.

## Verification

[Workflow tests](../../../../scripts/ci-workflow.spec.ts) parse both YAML files and require the explicit fork no-op, the non-fork condition on checkout and policy execution, and the combined non-fork/event condition on lifecycle token creation and mutation.

## Alternatives considered

**Compare `github.repository` with one canonical slug.** A literal repository name becomes stale after a transfer or rename and can disable the intended non-fork execution path. The event already carries the repository's fork classification directly.

**Select the fork repository dynamically.** This removes one endpoint mismatch but silently turns inherited governance into fork-owned policy without providing the matching Project, labels, App installation, or policy ownership.

**Skip the complete job or delete the workflows in forks.** A job-level skip produces a gray check and deleting upstream files increases merge drift. An explicit successful step keeps the inherited workflow visible and explains why it performed no action.

## Consequences

Fork pull requests keep successful Issue policy and Issue lifecycle jobs without checking out policy code, reading App credentials, calling policy endpoints, or mutating a Project. Non-fork repositories retain the behavior and configuration they already had, including any independently existing ownership misconfiguration. A fork that needs its own Issue automation must define and verify that ownership explicitly.
