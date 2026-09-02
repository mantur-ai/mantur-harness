# Agent Note: Mantur brand identity

Status: implemented

English | [中文](2026-09-02-mantur-brand-identity.zh.md)

## Problem

The desktop installer is a Mantur product for people producing comic dramas, but the shared Web composition presents DeepSeek Harness marks, Preview language, coding-agent copy, Agent Preset selection, and Plan controls. Replacing the whole Web client would duplicate the working application, while changing its defaults would rebrand every other deployment. A selected agent preset also shadows the deployment persona, so changing only the global system-prompt config does not establish the product identity a model receives.

## Decision

The shipped `mantur` profile stacks `dsh-base`, `dsh-web-app`, and `dsh-mantur-app`. The desktop carrier launches that profile; the ordinary `web` profile remains unchanged.

`dsh-client-ui-brand-mantur` occupies generic sidebar and blank-session Hero slots. It renders the approved symmetric blue infinity-loop logo and the confirmed text name `漫途Agent`, replaces the Hero headline with `故事起于一念，余下交给漫途` or its English equivalent, removes the Preview badge, and suppresses the official fish mark. The collapsed rail displays the Mantur logo until hover reveals the existing panel-navigation glyph. The generic conversation shell declares headline and badge slots with its existing copy as fallbacks, and the sidebar mark owner receives its expanded or rail placement.

The Mantur build emits product-owned browser install metadata: the document title, manifest name, and manifest short name are `漫途Agent`; its favicon and manifest icon use the approved 1024 px transparent PNG. Official and local-development builds retain their existing metadata and omit the unused Mantur file from their output.

The Mantur layer disables only the official brand, preview notice, Agent Preset client surface, and Plan client surface. It keeps their Host packages and agent composition capabilities, Models settings, DeepSeek credential onboarding, and model and permission controls. The layer also omits generic Harness and Web-surface prompt sections. Its Host identity row replaces the effective non-complete preset persona after cooperative prompt transforms, so the default Standard preset cannot turn the model back into a generic coding agent. The resulting persona identifies Mantur ownership, local execution, and comic-drama work from story through production delivery.

The onboarding slot has no withdrawal operation, so a later product plugin cannot remove entries already registered by `ui-settings-models`. The only upstream-owned product file changed for this exception is `packages/client/ui-settings-models/src/client/index.ts`: it leaves the Models section and DeepSeek credential onboarding intact and skips only the preview notice when the existing client build profile is `mantur`. Its focused apply test is the upgrade check for that gate.

The Web public directory and desktop resources directory carry byte-identical copies of the approved PNG. The desktop packager uses that file for both macOS and Windows targets, while the focused asset test prevents either copy or target configuration from drifting independently. A vector source remains unavailable.

## Verification

Client unit tests cover slot registration, disposal, localized text, logo placement, the absent badge, and the Mantur-only omission of the preview notice. Bundle tests apply the Base, Web, and Mantur patches in production order and assert the resulting rows and model persona. A keyless built-Web recorded-session scenario boots the real composition in Chinese and English, rejects the preview notice plus the generic headline, fish, Preview, Agent Preset, and Plan UI, confirms both Mantur logo placements, and retains model and permission controls. Its credential-less case verifies that the Mantur account choice precedes the retained DeepSeek credential step. The same scenario replays a committed model turn and pins the complete Mantur system prompt. The PWA test verifies the Mantur manifest, PNG signature, and absence of an official favicon.

Native installer validation remains the three-runner matrix owned by the desktop carrier: macOS arm64, macOS x64, and Windows x64. Platform icon rendering, signing, notarization, and external release publication remain native-runner prerequisites outside this identity layer.

## Alternatives considered

**Fork the Web application.** Rejected because identity, copy, and visibility are composition choices; a fork would duplicate conversation, settings, persistence, and transport behavior.

**Change shared Web defaults.** Rejected because the ordinary `web` profile must retain its existing official identity and controls.

**Override only CSS or generated class names.** Rejected because hashed selectors are not package contracts and cannot remove model-visible identity.

**Change only the global deployment persona.** Rejected because an agent-scoped preset persona shadows it before assembly.

**Derive a monogram or temporary mark.** Rejected because the approved symmetric blue infinity loop is the single product mark across Web and native packages.

## Consequences

- Desktop users see one Mantur identity and a production-oriented home promise without losing model or permission selection.
- The underlying Agent Preset and Plan capabilities remain available to composition and diagnostics, but their ordinary client controls are absent from the Mantur profile.
- The Mantur deployment persona takes precedence over non-complete preset personas, while preset tools and skills remain intact.
- Other Web deployments keep their existing brand, headline, Preview badge, and controls.
- Replacing the approved raster artwork requires synchronized Web and desktop resource copies, while the desktop runtime and profile structure remain unchanged.
