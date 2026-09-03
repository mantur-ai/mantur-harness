---
description: "Mantur-only sidebar navigation and empty marketplace pages for the desktop client."
kind: "package-reference"
---

# `@deepseek-ai/dsh-client-ui-mantur-navigation`

English | [中文](README.zh.md)

## Summary

This browser-only plugin adds the Mantur sidebar's Features section, Skill Marketplace and Recipe Marketplace entries, and their independent empty root pages. It also replaces the grouped workspace heading with the localized product term Projects. The official Web composition does not load this package and keeps Workspaces unchanged.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Compose this package only through [`dsh-mantur-app`](../../bundle/mantur-app/README.md). The package fills `sidebar.navigation`, `sidebar.workspaces.heading`, and `main.page` after their owners declare them. Page selection belongs to the layout's transient store, so every reload starts on the current conversation and keeps no marketplace route on disk.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The browser plugin installs one localized navigation occupant, one Projects-heading occupant, and one root-page occupant. The navigation writes the selected branded page identifier to the layout store; the root-page occupant renders the matching empty page and closes it through the owner action. Disposing the plugin removes the three occupants and its locale dictionary.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

These pages own the shared extension points and the Mantur composition.

- [ui-layout](../ui-layout/README.md) — transient root-page state and the `main.page` seat.
- [ui-sidebar](../ui-sidebar/README.md) — navigation and workspace seats.
- [mantur-app](../../bundle/mantur-app/README.md) — the product composition that mounts this package.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package contributes browser presentation only and registers nothing model-facing.

#### KV Cache effect

None; navigation and empty-page text never reaches a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The pages intentionally contain no ManturHub request, installation, recipe execution, payment, or catalog data.
- Marketplace content and actions arrive in later product work; this package owns only the navigation and page entry points.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. Disposing the browser plugin removes all three Mantur occupants and its dictionaries.
