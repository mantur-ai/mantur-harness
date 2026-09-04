# Agent Note: Keeping Mantur environment control local

Status: implemented

English | [中文](2026-09-04-mantur-local-environment-control.zh.md)

## Problem

Production and test deployment selection is an operator concern, but the Mantur Account page exposed it to every desktop user. A user could direct login, marketplace, detail, and download requests to an arbitrary HTTP(S) origin and replace the environment used by the whole application. The browser also received deployment names and URLs that it did not need for account presentation.

The [environment-isolation decision](../architecture/2026-09-03-mantur-environment-isolation.md) still requires one selection for all Mantur online requests and an origin-specific credential record.

## Decision

The `mantur-account` row in the machine-local Mantur profile patch is the only environment control. Its `environment`, `baseUrl`, and `testBaseUrl` fields select the deployment at Host plugin activation. The account Remote cannot read or change these fields, and the account page contains only login status, device authorization, and sign-out controls.

The installed macOS application reads `~/Library/Application Support/mantur-agent/harness/profiles/mantur/cordis.patch.yml`; development runs use the `mantur-agent-dev` sibling. Maintainers keep the complete three-field config in this id-targeted patch, change `environment` between `production` and `test`, and restart the desktop application so no browser account or marketplace state survives the change.

The Host rejects `test` without a distinct HTTP(S) `testBaseUrl`. Credential keys remain scoped by environment and complete origin as defined by the isolation decision. A previously written `manturhub` settings section is inert and contains no grant.

## Alternatives considered

**Keep the selector behind a development flag.** This retains browser mutation code and its Remote API in production builds, while runtime flag mistakes can expose the control to users.

**Select the deployment only with an environment variable.** Installed applications do not have a convenient persistent launch shell, while the profile patch already provides an application-owned local configuration file.

**Publish a separate test application.** Separate application data provides stronger isolation, but duplicates packaging and update channels for a maintainer-only selection. The existing origin-scoped credentials provide the required online isolation within one installation.

## Consequences

Desktop users cannot see the configured endpoint or switch deployments. Maintainers edit one local config field and restart the app. Anyone who can edit the application-owned Harness home can still select another server, which is consistent with local configuration ownership.

The browser Remote and generated Cordis API omit the environment status and mutation method. Configuration validation fails during Host activation instead of presenting a browser error. Login, Skill Marketplace, Recipe Marketplace, details, and downloads continue to share one active deployment, while installed local Skills remain shared.

## Testing

The Mantur account component and Web ARIA snapshot contain no environment controls. Host integration tests select test through plugin configuration, verify request routing and credential separation, and reject invalid local endpoint combinations. Generated API and configuration catalogs pin the reduced Remote and retained Host config fields.
