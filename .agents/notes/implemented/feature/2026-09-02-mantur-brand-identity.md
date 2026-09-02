# Agent Note: Mantur brand identity

Status: implemented

English | [中文](2026-09-02-mantur-brand-identity.zh.md)

## Problem

The desktop installer is a Mantur product for people producing comic dramas, but the shared Web composition presents DeepSeek Harness marks, Preview language, coding-agent copy, Agent Preset selection, and Plan controls. Replacing the whole Web client would duplicate the working application, while changing its defaults would rebrand every other deployment. A selected agent preset also shadows the deployment persona, so changing only the global system-prompt config does not establish the product identity a model receives.

## Decision

The shipped `mantur` profile stacks `dsh-base`, `dsh-web-app`, and `dsh-mantur-app`. The desktop carrier launches that profile; the ordinary `web` profile remains unchanged.

`dsh-client-ui-brand-mantur` occupies generic sidebar and blank-session Hero slots. It renders the confirmed text name `漫途Agent` in the sidebar, leaves the Hero prefix empty, replaces the Hero headline with `故事起于一念，余下交给漫途` or its English equivalent, removes the Preview badge, and suppresses the official fish mark. The collapsed rail keeps the existing panel-navigation glyph as an affordance, not a brand mark. The generic conversation shell now declares headline and badge slots with its existing copy as fallbacks, and the sidebar mark owner receives its expanded or rail placement.

The Mantur layer disables only the official brand, Agent Preset client surface, and Plan client surface. It keeps their Host packages and agent composition capabilities, and it keeps model and permission controls. The layer also omits generic Harness and Web-surface prompt sections. Its Host identity row replaces the effective non-complete preset persona after cooperative prompt transforms, so the default Standard preset cannot turn the model back into a generic coding agent. The resulting persona identifies Mantur ownership, local execution, and comic-drama work from story through production delivery.

No logo or native application icon is introduced. Until Mantur supplies approved artwork, text is the only product identity and the desktop build retains its packaging placeholder icon.

## Verification

Client unit tests cover slot registration, disposal, localized text, the absent expanded mark and badge, and the retained rail affordance. Bundle tests apply the Base, Web, and Mantur patches in production order and assert the resulting rows and model persona. A keyless built-Web Playwright scenario boots the real composition, verifies the Chinese brand and headline, rejects the generic headline, fish, Preview, Agent Preset, and Plan UI, confirms model and permission controls after Workspace connection, and assembles an agent prompt through the default preset.

Native installer validation remains the three-runner matrix owned by the desktop carrier: macOS arm64, macOS x64, and Windows x64. Formal visual assets, signing, notarization, and external release publication remain prerequisites outside this identity layer.

## Alternatives considered

**Fork the Web application.** Rejected because identity, copy, and visibility are composition choices; a fork would duplicate conversation, settings, persistence, and transport behavior.

**Change shared Web defaults.** Rejected because the ordinary `web` profile must retain its existing official identity and controls.

**Override only CSS or generated class names.** Rejected because hashed selectors are not package contracts and cannot remove model-visible identity.

**Change only the global deployment persona.** Rejected because an agent-scoped preset persona shadows it before assembly.

**Invent a temporary Mantur logo.** Rejected because no visual mark has been approved; an arbitrary monogram would become an unsupported product asset.

## Consequences

- Desktop users see one Mantur identity and a production-oriented home promise without losing model or permission selection.
- The underlying Agent Preset and Plan capabilities remain available to composition and diagnostics, but their ordinary client controls are absent from the Mantur profile.
- The Mantur deployment persona takes precedence over non-complete preset personas, while preset tools and skills remain intact.
- Other Web deployments keep their existing brand, headline, Preview badge, and controls.
- Approved logo and native icon artwork can later replace the text-only occupants without changing the desktop runtime or profile structure.
