# Agent Note: Thin desktop carrier

Status: implemented

English | [中文](2026-09-02-thin-desktop-carrier.zh.md)

## Problem

Harness users who do not work from a terminal need a normal desktop installer, but a second desktop-specific agent assembly would duplicate the Web application, plugin composition, persistence, security policy, and release behavior. Cross-platform installers also need native evidence because Electron, native modules, DMG creation, and NSIS behave differently on each operating system and architecture.

## Decision

`apps/desktop` is a thin Electron carrier around the existing Web profile. The Electron main process starts the built `@deepseek-ai/dsh` entry with `--profile web`, a random `127.0.0.1` port, and browser opening disabled. It accepts only the tokenized loopback readiness URL and loads that URL in a renderer with sandboxing, context isolation, and Node integration disabled. The native process owns window lifecycle and terminates the child; the DSH profile owns every agent, tool, credential, session, and Web behavior.

Electron also supplies the child process's Node runtime through `ELECTRON_RUN_AS_NODE=1`. This keeps one runtime in each installer and preserves the rule that supported Node applications start through a named `dsh` profile. The desktop dependency root includes the existing Python deploy closure plus the Web application closure and the required session-title peer; electron-builder rebuilds native dependencies for the target Electron runtime.

The client build profile `mantur` fixes `DSH_CLIENT_TITLE` to `漫途Agent` together with the repository version and commit metadata. It does not replace the upstream in-app logo, invent an icon, or declare a permanent application identifier. electron-builder therefore uses its default icon and derived identifier for these internal artifacts.

## Packaging and verification

The native matrix runs macOS arm64, macOS x64, and Windows x64 from one checked-out commit. Each runner performs the full Mantur build, unit tests the launch grammar and branded build environment, creates only its native installer, and starts DSH from the unpacked application's dependency directory. The smoke performs the process-token exchange, requests the authenticated page, and requires HTTP 200, the Web boot payload, and the `漫途Agent` document title.

The artifacts are unsigned internal DMG and one-click NSIS installers. The private desktop workspace is excluded from the npm release family, and the workflow retains installers as private Actions artifacts with no tag, release, signing, notarization, publication, or updater path. A target is not considered validated until its native packaging and packaged smoke both pass.

## Alternatives considered

**Embed Harness Host and replace HTTP with Electron IPC.** Rejected because it creates a desktop-specific application assembly and transport, duplicates existing Web authentication and lifecycle behavior, and requires a larger upstream divergence before one-click installation proves demand for those changes.

**Open the existing Web profile only in the system browser.** Rejected because it does not provide the installed application, single-instance window, and application lifecycle that users expect from a desktop client.

**Bundle an independent Node executable beside Electron.** Rejected because Electron already provides a compatible Node mode and electron-builder rebuilds native modules for it. A second runtime increases installer size and creates another version and license payload to maintain.

**Cross-build every target on one host.** Rejected because producing an archive does not prove that target-specific native modules load or that the packaged application starts. Native runner smoke is the acceptance evidence.

## Consequences

- Desktop users get ordinary installers while the Web profile remains the only interactive Harness application implementation.
- The loopback child process adds one local HTTP lifecycle and makes startup failure visible in a native localized dialog.
- The full runtime dependency closure and unpacked files make the installer larger than a dedicated client; this cost avoids a second application runtime and keeps Loader and native-module paths ordinary.
- Formal branding, stable application identity, signing, notarization, auto-update, and public release remain explicit prerequisites for an external distribution rather than hidden defaults in the internal baseline.
