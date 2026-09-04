# Agent Note: Windows coverage image fixture and rewrite budget

Status: implemented

English | [中文](2026-09-04-windows-coverage-image-and-rewrite-budgets.zh.md)

## Problem

Two behavior tests in the blocking Windows coverage lane depended on runner speed. The antialiased-text normalization case rasterized a 1024×512 SVG, downscaled it, encoded JPEG, and read image statistics. A successful hosted Windows run needed 13.3 seconds for this one case, while a later run exhausted the lane's 90-second per-test budget. The archived projection fixture also waited only 5 seconds for an asynchronous checkpoint rewrite; under the same contended run it read the current document before the title write landed.

Neither test owns a performance requirement. The image case verifies that a two-times downscale and JPEG normalization preserve dark and light values. The projection case verifies the eventual stored version, lineage, and title.

## Decision

Halve both dimensions of the generated image fixture and its target while preserving the 2:1 aspect ratio, two-times downscale, antialiased text, JPEG output, and contrast assertions. This reduces the source pixel count by four without changing the behavior under test.

Give the asynchronous projection rewrite 30 seconds on Windows and keep the existing 5-second deadline elsewhere. The observable stored fields remain the assertion; a write that never lands still fails within the Windows coverage lane's 90-second per-test budget. Product image normalization and projection persistence code do not change.

## Verification

- `pnpm exec vitest run packages/attachment/attachment-local/tests/normalization.spec.ts packages/session/session-projection-cache/tests/fixtures.spec.ts scripts/benchmark-npm-resolution.spec.ts`
- `pnpm run doc-sync`
- The blocking `windows node 24 / coverage` pull-request job exercises the Windows-specific rewrite budget and native Sharp path.

## Alternatives considered

**Increase the lane-wide 90-second test timeout.** Rejected because the image fixture can provide the same evidence with fewer pixels, and only the asynchronous rewrite needs a larger local deadline.

**Skip either case on Windows.** Rejected because Sharp normalization and durable projection rewrites both need native Windows evidence.

## Consequences

The image behavior test performs less native work, and the projection test tolerates a slow checkpoint without weakening its stored-data assertions. Other platforms keep their existing rewrite deadline, and production behavior is unchanged.
