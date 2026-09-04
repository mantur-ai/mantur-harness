---
description: "ManturHub device authorization provider and browser-safe account Remote for the Mantur desktop profile."
kind: "package-reference"
---

# `@deepseek-ai/dsh-authorization-manturhub`

English | [中文](README.zh.md)

## Summary

This Host package owns the active ManturHub production or test deployment, registers one `ctx.authorization` device-code flow per configured origin, and routes every `manturAccount.request()` through the selected deployment. Each origin has a distinct Host credential record. The generated `manturAccount` Remote returns deployment status, device instructions, account email, progress, local sign-out, and a persistent environment switch; it never returns an API key.

## Table of Contents

- [Configuration](#configuration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="configuration"></a>

## Configuration

`environment` defaults to `production`. `baseUrl` defaults to `https://hub.mantur.ai` and names the production origin; `testBaseUrl` names the optional test origin and is required before `test` can be selected. Both values must be HTTP(S) origins without credentials, paths, queries, or fragments, and the test origin must differ from production. The writable `manturhub` settings section applies changes live. Changing the selected environment cancels an active device flow, while the desktop browser reload clears its in-memory account and marketplace state.

The public production origin retains the original credential key so an existing production login remains valid. Every other production or test origin uses an environment-and-origin-specific credential key. Changing a test URL therefore starts signed out instead of sending the previous test grant to a new server. Environment settings persist only names and URLs; grants remain in the credential provider.

A verification URL on another origin is rejected. A session that omits `interval` or `expires_in` uses 5 seconds and 600 seconds. `slow_down` adds 5 seconds to the active polling interval; denial and expiry end the attempt without a credential.

## Model Experience

### Account authorization

#### What the model sees

The `manturAccount` authorization state remains outside every model request; no account identity, device code, or credential is included.

#### Token effect

The authorization flow contributes zero tokens to model requests.

#### KV Cache effect

Authorization does not alter model request prefixes or cache reuse.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Login attempts are process-local and are cancelled when the Host stops.
- Sign-out removes the local grant; server-side revocation is outside this MVP.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The device and account endpoints are resolved from one configured origin. The package-owned bounded JSON reader is shared with ManturHub Host consumers so response buffering follows one implementation. Tests select a loopback fake server.

</details>

No runtime invariant companion is published because the authorization service both commits the credential and reports success, so no independently observed values can diverge.
