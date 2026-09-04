# Agent Note: Web hover-action synchronization

Status: implemented

English | [中文](2026-09-04-web-hover-action-stability.zh.md)

## Problem

The blocking Web snapshot lane intermittently found a Workspace action button in the DOM but kept observing it as hidden for the full Playwright timeout. The button is intentionally revealed only while its row matches `:hover`. A projection update can replace that row after the first hover, leaving the pointer over old geometry while the newly resolved button remains hidden.

The scenario verifies that a person can reveal and activate the real hover-only control. Forcing the click or selecting the hidden button directly would bypass that behavior.

## Decision

Poll the complete reveal precondition: hover the current row resolved by Playwright, then inspect whether its current action button is visible. Once visibility is observed, click the button normally. Each poll resolves the locators again, so a projection replacement cannot leave the test waiting on a hidden successor without restoring its hover state.

Production behavior, timeouts, and browser concurrency remain unchanged.

## Verification

- `DSH_SNAPSHOT=replay pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/workspace-management.e2e.ts`
- The blocking `node 24 / snapshots and artifacts` pull-request job runs the scenario with the repository Web snapshot concurrency.

## Alternatives considered

**Force the button click.** Rejected because it would activate a control that a person could not see.

**Increase the Playwright timeout.** Rejected because the failed state does not become visible by waiting; the current row must receive hover again.

## Consequences

The scenario waits for the same visible state a person needs before activation and remains valid when a projection replaces the row. Product code does not change.
