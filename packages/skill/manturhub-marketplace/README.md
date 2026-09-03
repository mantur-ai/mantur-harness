---
description: "Host-owned ManturHub Skill catalog projection and safe local installer."
kind: "package-reference"
---

# `@deepseek-ai/dsh-manturhub-marketplace`

English | [中文](README.zh.md)

## Summary

This Host plugin exposes browser-safe ManturHub Skill catalog, detail, and installation Remotes. Public metadata is validated before projection. Installation keeps the API key on the authenticated first hop, downloads an approved redirect without credentials, verifies archive limits and root metadata, and atomically commits the Skill directory with installer state.

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

Compose this package through [`dsh-mantur-app`](../../bundle/mantur-app/README.md). It requires `manturAccount`, reads public catalog and detail endpoints, and installs into `<DSH_HOME>/skills/<slug>`. Configuration bounds metadata bytes, compressed bytes, archive entries, uncompressed bytes, archive-listing output, and both request stages. The defaults match the official ManturHub CLI policy.

The list endpoint accepts the deployed `{ skills }` envelope and the CLI-compatible raw array. Detail accepts a direct Skill or `{ skill }`. Entries with `kind: suite` are excluded; a missing `kind` means `skill`.

-----

<a id="understand-installation-safety"></a>
## Understand installation safety

The first download request uses `manturAccount` with authentication and manual redirects. A redirect must include `Location`; its second request allows HTTPS, plus loopback HTTP for integration tests, and never receives the authorization header. The installer streams into a private temporary file and rejects compressed-size overflow before extraction.

Archive inspection rejects absolute paths, traversal, control characters, case-insensitive duplicate paths, symbolic links, hard links, excessive entries, and excessive declared expansion. A second filesystem walk rejects links, special nodes, and actual expansion overflow. Root `SKILL.md` must declare the requested slug and catalog version.

Installer state stores content and bundle SHA-256 values outside the discoverable Skill root. An update proceeds only when the destination is tracked and its current content hash still matches. Untracked or locally modified destinations fail visibly. Directory and state replacement use same-filesystem renames; a state-write failure restores the previous directory.

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
- The archive reader depends on the platform `unzip` or `tar` command and fails clearly when neither is available.
- Recipe installation and operator execution are outside this package.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Host tests use real loopback HTTP servers and temporary `DSH_HOME` directories. They prove deployed response envelopes, credential isolation, archive policy, local-conflict refusal, rollback, and live filesystem watcher invalidation.

</details>

**Runtime invariant:** No companion is published. API validation, archive inspection, post-extraction inspection, metadata validation, content hashing, and atomic rollback reject each independently observable invalid installation state.
