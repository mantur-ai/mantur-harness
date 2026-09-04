# Agent Note: Share bounded ManturHub JSON reading

Status: implemented

English | [中文](2026-09-03-share-manturhub-json-reader.zh.md)

## Problem

The ManturHub authorization provider and marketplace Host both read untrusted JSON response streams under a byte limit. Their separate readers had identical accumulation, cancellation, concatenation, decoding, and parsing logic. Keeping both copies allowed fixes to response buffering or cancellation to reach one ManturHub consumer without the other even though the authorization package already owns the common ManturHub request origin and credential policy.

## Decision

`@deepseek-ai/dsh-authorization-manturhub` exports `readManturHubJson` as the shared bounded response reader. The authorization flow supplies its fixed 64 KiB limit and `response` diagnostic subject; the marketplace supplies its configured metadata limit and `metadata` subject. Each consumer continues to own HTTP status handling and schema validation because those rules differ by endpoint.

## Alternatives considered

- **Keep two local readers and exclude them from duplication checks.** Rejected because the copies implement the same security-relevant byte limit and cancellation behavior; suppressing the check would preserve divergence risk.
- **Move all ManturHub requests into the marketplace package.** Rejected because API origin and credential attachment belong to the authorization provider, while catalog projection and Skill installation belong to the marketplace.
- **Add one request-and-parse service method.** Rejected because endpoint methods intentionally differ in HTTP status ordering and schemas; a broad method would either duplicate those policies in options or hide them from their owners.

## Consequences

ManturHub Host consumers share one implementation for bounded JSON stream reading while retaining their existing limits, diagnostics, HTTP status ordering, and schema validation. The authorization package gains one small public utility export, and its focused tests pin parsing, overflow diagnostics, and missing-body rejection.
