# Agent Note: Mantur marketplace navigation

Status: implemented

English | [中文](2026-09-03-mantur-marketplace-navigation.zh.md)

## Problem

Mantur Agent needs product-only Skill Marketplace and Recipe Marketplace entry points above its project browser. The official Web client must keep its Workspace terminology and conversation-first start, while the marketplace MVP needs an independent center surface without pretending a click-through overlay is a page.

## Decision

`ui-layout` owns a transient branded `MainPageId | undefined` in its root-entry store and declares the single root-scoped `main.page` slot. An active page hides but does not unmount the conversation surface, renders details at zero width without changing its stored preference, and receives a close action that restores the current conversation. The store has no persistence, so reload always starts on the conversation.

`ui-sidebar` declares `sidebar.navigation` before `sidebar.workspaces` and passes the active page plus open and close actions to its occupant. Starting a new session closes the page first. The workspace browser receives the same return action and uses it before opening, starting, or forking a Session. An active Mantur root-page occupant also invokes the close action when plugin disposal or replacement unmounts it, so the transient layout store cannot retain an identifier whose renderer has disappeared.

`ui-workspace` declares the nested `sidebar.workspaces.heading` slot with its existing localized Workspace label as fallback. The Mantur-only `ui-mantur-navigation` package fills all three extension points: a semantically named Features navigation group, the localized Projects heading, and the independent Skill and Recipe pages. The visual navigation follows the approved layout without a visible Features heading; its accessible navigation name retains the group identity. The official profile does not compose this package.

The Skill page mounts a generated Remote and keeps catalog, detail, installation, and device-login state in one root-scoped browser controller. A new Host `manturhub-marketplace` package validates the deployed ManturHub response envelopes and projects only browser-safe metadata. The Host owns every authenticated request and filesystem operation. Installation authenticates only the first download hop, requires an explicit safe redirect for the second hop, and never forwards credentials to the bundle origin. It bounds the download, streams ZIP entries into private staging files, and rejects unsafe cross-platform paths, links, special nodes, imprecise sizes, excessive entry counts, and declared or actual expansion before each write. It rechecks the extracted filesystem, verifies root `SKILL.md` name and version, and then commits by same-filesystem rename. Tracked content hashes prevent overwriting local modifications; untracked destinations also fail. Before an update, the old Skill moves to a unique recovery directory outside the discoverable Skill root. A state-commit failure restores it, while a rollback failure preserves and reports the exact recovery path. The live Skill filesystem watcher discovers the committed rename without restarting the desktop app.

The Recipe copy defines a Recipe as a proven creative example with a result sample, prompt template, reproducible operator parameters, model and operator details, and an estimated recreation cost, not as a general workflow template. It states that Recipes are free and that operator execution requires real-time quote confirmation before it starts.

## Alternatives considered

**Hardcode Mantur terminology and links in `ui-sidebar`.** This would leak deployment copy into the official shell and make every product-specific destination part of a shared package, so the product package owns the occupants instead.

**Render marketplace pages in `shell.overlay`.** That slot is a click-through floating layer and leaves the conversation reachable behind it. Treating it as primary navigation would give the wrong accessibility and layout behavior.

**Persist the selected marketplace route.** The requested default is the current conversation after every reload. Keeping selection in the existing transient layout store meets that behavior without a second route store.

**Download and extract in the browser.** This would expose authorization and filesystem mutation to presentation code. Generated Remotes instead keep both on the Host and return only explicit success or typed failure.

**Overwrite an existing directory or add a force option.** The browser cannot establish whether local content is disposable. Installer-owned hashes permit updates only for unchanged tracked content and surface every other case as a conflict.

## Consequences

The shared client gains two generic extension points and one transient page selector, while Mantur copy and page structure remain isolated in product packages. Only one root-page occupant can be composed at a time. Skill catalog reads and safe installation are available in the Mantur profile. Forced overwrite, uninstall, recipe catalog, operator execution, quote confirmation, payment, and route persistence remain absent.
