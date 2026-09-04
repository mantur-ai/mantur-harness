# Agent Note: Web Workspace creation settlement

Status: implemented

English | [中文](2026-09-04-web-hover-action-stability.zh.md)

## Problem

The blocking Web snapshot lane intermittently failed while opening the action menu of a Workspace created by the preceding test. The creation helper returned after the directory was registered and its title appeared, but the product was still creating and attaching that Workspace's blank Session and Agent. That later projection update could replace the row between the hover-only action button becoming visible and Playwright clicking it.

Retrying the hover until the button became visible did not close the lifecycle race: the next CI run observed visibility and then lost the locator before the ordinary click completed.

## Decision

Make the creation helper wait until the Agent count increases after each new Workspace is registered. This is the same host-owned settlement signal already used when the scenario adopts an existing directory that can create a blank Session. The next test therefore starts after Workspace registration and its initial Session attachment have both settled.

Keep the action interaction unchanged: hover the row, hover the visible button, and click it normally. Product behavior, timeouts, and browser concurrency remain unchanged.

## Verification

- `DSH_SNAPSHOT=replay pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/workspace-management.e2e.ts`
- `DSH_SNAPSHOT=replay DSH_WEB_SNAPSHOT_WORKERS=2 pnpm run test:web:ci`
- The blocking `node 24 / snapshots and artifacts` pull-request job runs the scenario with the repository Web snapshot concurrency.

## Alternatives considered

**Retry the action click.** Rejected because a click can have an effect before an observer sees its completion; retrying an effect is not a safe synchronization mechanism.

**Force the button click or increase its timeout.** Rejected because neither waits for the Workspace creation lifecycle that replaces the row.

## Consequences

The create test owns completion of the blank Session it starts, and the following rename test interacts with a settled Workspace row. Product code does not change.
