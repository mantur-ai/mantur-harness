---
description: "Mantur-only sidebar navigation, Skill Marketplace, and Recipe Marketplace presentation for the desktop client."
kind: "package-reference"
---

# `@deepseek-ai/dsh-client-ui-mantur-navigation`

English | [中文](README.zh.md)

## Summary

This browser-only plugin adds the Mantur sidebar's Skill Marketplace and Recipe Marketplace entries and their independent root pages. The Skill page reads a Host-projected ManturHub catalog, opens details, gates installation on device login, and displays installation and local-conflict states. A Recipe means a proven creative example that can be reproduced with replaced user content; it is not a general workflow template. The package also replaces the grouped workspace heading with the localized product term Projects. The official Web composition does not load this package and keeps Workspaces unchanged.

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

Compose this package only through [`dsh-mantur-app`](../../bundle/mantur-app/README.md). The package fills `sidebar.navigation`, `sidebar.workspaces.heading`, and `main.page` after their owners declare them, then mounts the browser-safe marketplace Remote. Opening the Skill page loads the public catalog and local installation flags. Selecting a card loads its detail; an authenticated install writes through the Host service and updates the visible card only after Host confirmation. A signed-out install starts the existing ManturHub device-login flow. Page selection belongs to the layout's transient store, so every reload starts on the current conversation and keeps no marketplace route on disk.

The Recipe page loads the public ManturHub catalog with server-side text and category filters, renders result samples and pagination, and opens an inline detail with replaceable inputs, prompt template, models, operators, and the authoritative reproduction guide. The Recipe itself is free; operator execution uses a real-time quote confirmed before work starts. “Recreate with Agent” creates a new Session in the current Project and submits the Hub-provided `agent_payload` with the Recipe slug and source URL as its first user message.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The browser plugin installs one localized navigation occupant, one Projects-heading occupant, one root-page occupant, and one root-scoped marketplace controller. The controller owns separate Skill and Recipe catalog and detail snapshots while generated Remotes keep credentials and filesystem access on the Host. Recipe launch resolves the current Workspace through the existing controllers, creates a Session, opens it, and sends the reproduction request through the scoped Conversation service. The navigation writes the selected branded page identifier to the layout store; the root-page occupant renders the matching page and closes it through the owner action. When an active root-page occupant unmounts during plugin disposal or replacement, it also clears its page identifier so the conversation becomes visible. Disposing the plugin invalidates pending state changes, clears login polling, removes the three occupants, and removes its locale dictionary.

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

None, as this package contributes no hidden model context; the selected Recipe instead becomes an ordinary durable first user message containing its title, slug, source URL, and exact ManturHub `agent_payload`.

#### KV Cache effect

The Recipe message contributes ordinary user-prompt tokens once. Navigation, catalog cards, detail metadata, and other UI copy do not enter provider requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Recipe discovery and handoff are available. Operator execution, quote confirmation, and payment continue inside the Agent and ManturHub capabilities rather than this presentation package.
- The Skill page supports installation but intentionally provides no forced overwrite or uninstall action. A tracked directory modified after installation and any pre-existing untracked directory require manual resolution.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. Component and store tests cover catalog loading, empty and failed responses, detail selection, signed-in installation, device login, conflicts, and disposal-owned polling; Host integration tests own filesystem and credential safety.
