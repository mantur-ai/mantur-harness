# Agent Note: Windows coverage image fixture and awaited rewrite

Status: implemented

English | [中文](2026-09-04-windows-coverage-image-and-rewrite-budgets.zh.md)

## Problem

Two behavior tests in the blocking Windows coverage lane depended on runner speed. The antialiased-text normalization case rasterized a 1024×512 SVG, downscaled it, encoded JPEG, and read image statistics. A successful hosted Windows run needed 13.3 seconds for this one case, while a later run exhausted the lane's 90-second per-test budget. The archived projection fixture also polled the filesystem for a background checkpoint rewrite. After extending that poll from 5 to 30 seconds exposed the same stale title in the legacy-v3 case, the failure was no longer attributable to a merely slow runner.

Neither test owns a performance requirement. The image case verifies that a two-times downscale and JPEG normalization preserve dark and light values. The projection case verifies the eventual stored version, lineage, and title.

## Decision

Halve both dimensions of the generated image fixture and its target while preserving the 2:1 aspect ratio, two-times downscale, antialiased text, JPEG output, and contrast assertions. This reduces the source pixel count by four without changing the behavior under test.

Make the archived fixture await `SessionProjectionCache.write(session)` before reading the rewritten document. The automatic `turn/end` write policy already has focused coverage in `cache.spec.ts`; this fixture owns cross-version rewrite output, so it now waits for the public write operation whose durable result it inspects instead of guessing when a background listener will finish. Product image normalization and projection persistence code do not change.

## Verification

- `pnpm exec vitest run packages/attachment/attachment-local/tests/normalization.spec.ts packages/session/session-projection-cache/tests/fixtures.spec.ts scripts/benchmark-npm-resolution.spec.ts`
- `pnpm run doc-sync`
- The blocking `windows node 24 / coverage` pull-request job exercises the awaited legacy rewrite and native Sharp path.

## Alternatives considered

**Increase the lane-wide 90-second test timeout.** Rejected because the image fixture can provide the same evidence with fewer pixels, and the rewrite test can await the durable operation directly.

**Skip either case on Windows.** Rejected because Sharp normalization and durable projection rewrites both need native Windows evidence.

## Consequences

The image behavior test performs less native work, and the projection fixture no longer depends on background-listener scheduling. The stored-data assertions remain unchanged, and production behavior is unchanged.
