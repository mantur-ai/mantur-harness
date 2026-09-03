---
description: "ManturHub device authorization provider and browser-safe account Remote for the Mantur desktop profile."
kind: "package-reference"
---

# `@deepseek-ai/dsh-authorization-manturhub`

English | [中文](README.zh.md)

## Summary

This Host package registers one `ctx.authorization` device-code flow for `https://hub.mantur.ai`. The flow creates and polls a ManturHub device session, verifies the account, and commits the returned API key only as a Host credential record. Its generated `manturAccount` Remote returns device instructions, account email, progress, and local sign-out; it never returns the API key.

## Table of Contents

- [Configuration](#configuration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="configuration"></a>

## Configuration

`baseUrl` defaults to `https://hub.mantur.ai`. Tests and private deployments may select another HTTP(S) origin. A verification URL on another origin is rejected. A session that omits `interval` or `expires_in` uses the installed ManturHub CLI values of 5 seconds and 600 seconds. `slow_down` adds 5 seconds to the active polling interval; denial and expiry end the attempt without a credential.

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

The device and account endpoints are resolved from one configured origin. Tests select a loopback fake server.

</details>

No runtime invariant companion is published because the authorization service both commits the credential and reports success, so no independently observed values can diverge.
