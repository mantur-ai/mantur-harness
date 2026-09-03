# Agent Note: Mantur account onboarding

Status: implemented

English | [中文](2026-09-03-mantur-account-onboarding.zh.md)

## Problem

Mantur Agent needs an optional ManturHub account before model setup, but the browser must never receive the account API key. The shared Web profile already owns DeepSeek credential onboarding and the settings shell, while the credentials and authorization packages already own secret persistence and interactive grant lifecycle.

## Decision

The Mantur profile adds `dsh-authorization`, `dsh-authorization-manturhub`, and `dsh-client-ui-mantur-account`. The Host provider registers one device-code authorization flow, uses the ManturHub CLI session and poll protocol, validates that the verification page stays on the configured origin, retains only the account email, and commits the API key as a provider-owned `CredentialRecord`. Missing session timing uses the CLI defaults; `slow_down` increases the active interval, while denial and expiry fail the attempt. Its generated Remote exposes only account status, device instructions, process-local progress, cancellation, and local sign-out.

The client mounts the generated Mantur account Remote contribution inside its own plugin and contributes onboarding order `-100`. A user either starts the device flow and opens its verification URL in the system browser, or temporarily skips the step. Completion transfers ownership to the existing DeepSeek credential step at order `0`. The Mantur build condition in `ui-settings-models` suppresses only the official preview notice; it no longer suppresses DeepSeek setup. A separate Settings section reuses the same root-scoped account controller for status, login, and sign-out.

The MVP does not provide operator calls, skill installation, upload, billing, token refresh, or server-side revocation. Those features require separate capability seams and product decisions.

## Verification

A local fake HTTP server covers session defaults, increased polling delay, denial, expiry, malformed or oversized responses, cancellation and teardown, account lookup, Host-only credential persistence, sanitized status, and sign-out without production traffic or real keys. Client apply, state-controller, and component tests cover locale ownership, registration, order, disposal, every account state, and user controls. Focused coverage reaches the repository's per-file 100% requirement for both new packages. Bundle composition tests require the authorization provider and UI rows, and the existing Models apply test requires DeepSeek onboarding without the preview notice under the Mantur build profile. The keyless built-Web Mantur recorded-session scenario exercises the real onboarding order in Chinese and the account skip path in both shipped locales.

## Alternatives considered

**Return the ManturHub key to browser code.** Rejected because renderer compromise would expose a reusable account secret and duplicate credential persistence outside the Host.

**Replace the shared onboarding shell.** Rejected because ordered slot contributions already express the required account-before-model sequence.

**Persist the temporary skip.** Rejected for this MVP because “Not now” is a session choice, not a durable rejection of the account feature.

## Consequences

- ManturHub API keys remain in the Host credential file and generated Remote output cannot carry them.
- Device attempts do not survive a Host restart; an interrupted user starts again.
- “Not now” is intentionally temporary and may appear in a later fresh onboarding sequence.
- The only shared product-code exception remains the Mantur build condition in `ui-settings-models`; its focused test is the upstream-upgrade check.
