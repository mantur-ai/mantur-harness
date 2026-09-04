# Agent Note: Isolating Mantur online environments

Status: implemented

English | [中文](2026-09-03-mantur-environment-isolation.zh.md)

## Problem

Mantur login and marketplace features shared one configured Hub origin and one credential key. Pointing a development build at a test deployment replaced that origin for every caller but did not represent the selected environment, retain both endpoints, or prevent a stored grant from being reused after an endpoint change. Browser catalog state could also outlive a live configuration change.

Login, Skill Marketplace, and Recipe Marketplace all depend on one account service. Configuring them independently would allow a split state in which account authorization targets one deployment while a catalog or download targets another.

## Decision

`dsh-authorization-manturhub` owns one production deployment and an optional test deployment. `environment` selects `production` or `test`; `baseUrl` names production and defaults to `https://hub.mantur.ai`; `testBaseUrl` must be supplied before test can be selected. Both endpoints are HTTP(S) origins without credentials, paths, queries, or fragments, and they must differ.

The provider registers an authorization flow for each configured origin. The public production origin retains the original credential key so existing production sign-ins survive the change. Every other grant key includes the environment name and a SHA-256 fingerprint of the complete origin. Production and test therefore cannot read each other's grants, and replacing a test URL cannot expose the previous test grant to the new server.

The [`mantur-account` machine-local configuration](../simplification/2026-09-04-mantur-local-environment-control.md) selects the active deployment. The account Remote does not expose or mutate this configuration. Login, catalog, detail, Recipe, and download requests enter ManturHub through `manturAccount.request()`, so they read one active deployment; maintainers restart the desktop application after a change to discard previous in-memory UI state.

Installed Skills remain local product assets. The live Skill directory and installer bookkeeping are shared across environments; changing the online environment does not remove or hide an installed Skill.

## Alternatives considered

**Keep one editable base URL and one grant.** This makes switching short, but a changed URL could inherit authorization minted for another server and loses the named production/test distinction.

**Give each marketplace and login its own endpoint selector.** This creates several switches and admits mismatched deployments. One account-owned selector keeps every Mantur online request aligned.

**Ship separate production and test application builds.** Separate application data directories provide stronger whole-product isolation, but they duplicate packaging and release operations for a routine developer action. Origin-scoped grants and a browser reload isolate the online state inside one installation.

**Namespace installed Skills by environment.** This would stop a test installation from affecting the production-visible local catalog, but it would also make local capabilities disappear merely because the remote catalog changed. The requested isolation applies to online content and credentials; installed files retain their existing local ownership and conflict checks.

## Consequences

Maintainers select production or test in the machine-local profile patch and restart the client. Returning to an environment restores only that origin's own prior sign-in.

All current ManturHub catalog, Recipe, detail, and download calls follow the selected origin without consumer-specific configuration. Profile patches contain no account secret. Existing users of the public production service keep their current local login.

Developers must supply a distinct test origin before selecting test. Installed Skills and their installer state remain shared local data, so normal version and local-conflict rules still apply across environment switches.

## Testing

Loopback Hub integration tests verify that local configuration routes requests to the selected origin, stores a distinct test grant, and starts signed out for the production and replacement-test origins. They reject missing, invalid, and production-equal test endpoints. Browser component and snapshot tests verify that account controls contain no environment selector.
