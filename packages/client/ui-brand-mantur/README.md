---
description: "Mantur Agent text-brand occupants for the sidebar and blank-session hero, for maintainers composing the Mantur desktop client."
kind: "package-reference"
---

# `@deepseek-ai/dsh-client-ui-brand-mantur`

English | [中文](README.zh.md)

## Summary

This package fills the generic sidebar with the localized `漫途Agent` product name and the blank-session hero with the Mantur product promise. It leaves the hero prefix empty, removes the official fish fallback, keeps the collapsed sidebar's ordinary panel control visible, and occupies the hero badge slot with no content so the Mantur composition does not show the Web Preview badge. It changes no layout, conversation, model, permission, or agent capability.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Compose this row only through [`dsh-mantur-app`](../../bundle/mantur-app/README.md). The browser half registers `sidebar.brand.mark`, `sidebar.brand.name`, `conversation.hero.brand.mark`, `conversation.hero.headline`, and `conversation.hero.badge` after their owners declare them. Both locales render the confirmed product name `漫途Agent` in the sidebar, while the hero starts directly with the Chinese headline `故事起于一念，余下交给漫途` or its English equivalent. The package does not invent an abbreviation, monogram, logo, or application icon.

<a id="model-experience"></a>
## Model Experience

None, as this package contributes browser presentation only and the Mantur model identity belongs to the profile bundle.

#### KV Cache effect

None; no text from this package reaches a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Formal visual assets are pending** — a confirmed logo and native application icon must replace no existing asset until Mantur supplies approved source artwork.
- **Text name is deliberate** — the current brand surface uses the complete product name in both locales and does not treat a temporary glyph as a brand mark.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The collapsed rail receives the existing panel glyph as a navigation affordance, not as brand artwork. The expanded row renders no mark beside the product name, and the hero brand-mark occupant renders nothing so the headline has no prefix.

</details>

**Runtime invariant:** No companion is published. One browser effect installs and removes all five slot occupants together.
