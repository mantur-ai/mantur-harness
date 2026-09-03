---
description: "Mantur account first-run and Settings surfaces for maintainers composing the Mantur desktop client."
kind: "package-reference"
---

# `@deepseek-ai/dsh-client-ui-mantur-account`

English | [中文](README.zh.md)

## Summary

This browser package adds the first Mantur onboarding step and a Mantur Account settings page. A user can sign in through a system-browser device flow or choose Not now; either path transfers onboarding to the existing DeepSeek API-key step. The Settings page shows sanitized account status and supports local sign-out.

The browser receives only an attempt id, verification URL, user code, expiry, progress, and account email. It never receives the ManturHub API key.

## Table of Contents

- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

## Model Experience

### Account surfaces

#### What the model sees

The `settings.onboarding` account surface remains browser presentation; its copy and state are never included in model requests.

#### Token effect

The account surfaces contribute zero tokens to model requests.

#### KV Cache effect

The account surfaces do not alter model request prefixes or cache reuse.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Not now applies to the current empty-session onboarding sequence and is offered again in a later fresh sequence.
- Operator access, skill installation, upload, and billing are deferred.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The onboarding and Settings occupants share one root-scoped controller and browser-safe Remote state.

</details>

**Runtime invariant:** the account onboarding slot has order `-100`, before the existing DeepSeek step at order `0`. No runtime invariant companion is published. This browser package owns no durable event stream or cross-plugin mutable state; its registration order and effect disposal are observed directly by package tests.
