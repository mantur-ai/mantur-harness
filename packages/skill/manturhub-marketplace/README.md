---
description: "Host-owned ManturHub Skill and Recipe catalog projection with safe local Skill installation."
kind: "package-reference"
---

# `@deepseek-ai/dsh-manturhub-marketplace`

English | [中文](README.zh.md)

## Summary

This Host plugin exposes browser-safe ManturHub Skill and Recipe catalog and detail Remotes plus Skill installation. Public metadata is validated before projection. Recipe media and source paths resolve against the configured Hub response origin. Installation keeps the API key on the authenticated first hop, downloads an approved redirect without credentials, verifies archive limits and root metadata, and atomically commits the Skill directory with installer state.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand installation safety](#understand-installation-safety)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Compose this package through [`dsh-mantur-app`](../../bundle/mantur-app/README.md). It requires `manturAccount`, reads public Skill and Recipe catalog and detail endpoints, and installs Skills into `<DSH_HOME>/skills/<slug>`. Recipe list reads are fixed at the Hub-supported 15 entries per page and accept page, category, tag, and text filters. Configuration bounds metadata bytes, compressed bytes, archive entries, uncompressed bytes, and both request stages. The defaults match the official ManturHub CLI policy.

The list endpoint accepts the deployed `{ skills }` envelope and the CLI-compatible raw array. Detail accepts a direct Skill or `{ skill }`. Entries with `kind: suite` are excluded; a missing `kind` means `skill`.

-----

<a id="understand-installation-safety"></a>
## Understand installation safety

The first download request uses `manturAccount` with authentication and manual redirects. A redirect must include `Location`; its second request allows HTTPS, plus loopback HTTP for integration tests, and never receives the authorization header. The installer streams into a private temporary file and rejects compressed-size overflow before extraction.

The ZIP reader validates every central-directory entry before it writes that entry. It rejects unsafe or imprecise sizes, absolute and traversal paths, control characters, Windows-reserved names and characters, trailing dots or spaces, case-insensitive duplicate paths, links, special nodes, excessive entries, and excessive declared expansion. Regular files are decompressed directly into private staging files while the installer enforces the actual cumulative byte limit. A second filesystem walk rechecks links, special nodes, and actual expansion. Root `SKILL.md` must declare the requested slug and catalog version.

Installer state stores content and bundle SHA-256 values outside the discoverable Skill root. An update proceeds only when the destination is tracked and its current content hash still matches. Untracked or locally modified destinations fail visibly. Directory and state replacement use same-filesystem renames. Before replacement, the previous directory moves into a unique recovery directory beside `skillsRoot`, never inside the discoverable Skill tree. A state-write failure restores that directory. If rollback itself fails, the error reports the exact preserved recovery path for manual restoration.

-----

<a id="further-exploration"></a>
## Further Exploration

- [authorization-manturhub](../../credentials/authorization-manturhub/README.md) — owns API origin, credentials, and device login.
- [ui-mantur-navigation](../../client/ui-mantur-navigation/README.md) — presents the projected catalog and installation states.
- [skill-filesystem](../skill-filesystem/README.md) — watches the live local Skill directory.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the existing filesystem provider that discovers a committed Skill for later catalog tool output.

#### KV Cache effect

Stable until installation commits a new Skill directory; later catalog tool output can then include that Skill.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- There is no forced overwrite, uninstall, or local-conflict merge operation.
- Skill bundles must use ZIP. Extraction is implemented in-process and does not depend on platform archive commands.
- Recipe handoff, operator execution, quote confirmation, and payment are outside this Host package; it returns the published `agent_payload` unchanged to its browser consumer.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Host tests use real loopback HTTP servers and temporary `DSH_HOME` directories. They prove deployed response envelopes, credential isolation, archive policy, local-conflict refusal, rollback, and live filesystem watcher invalidation.

</details>

**Runtime invariant:** No companion is published. API validation, archive inspection, post-extraction inspection, metadata validation, content hashing, and atomic rollback reject each independently observable invalid installation state.
