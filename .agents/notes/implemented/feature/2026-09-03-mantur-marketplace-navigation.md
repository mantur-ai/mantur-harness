# Agent Note: Mantur marketplace navigation

Status: implemented

English | [中文](2026-09-03-mantur-marketplace-navigation.zh.md)

## Problem

Mantur Agent needs product-only Skill Marketplace and Recipe Marketplace entry points above its project browser. The official Web client must keep its Workspace terminology and conversation-first start, while the marketplace MVP needs an independent center surface without pretending a click-through overlay is a page.

## Decision

`ui-layout` owns a transient branded `MainPageId | undefined` in its root-entry store and declares the single root-scoped `main.page` slot. An active page hides but does not unmount the conversation surface, renders details at zero width without changing its stored preference, and receives a close action that restores the current conversation. The store has no persistence, so reload always starts on the conversation.

`ui-sidebar` declares `sidebar.navigation` before `sidebar.workspaces` and passes the active page plus open and close actions to its occupant. Starting a new session closes the page first. The workspace browser receives the same return action and uses it before opening, starting, or forking a Session. An active Mantur root-page occupant also invokes the close action when plugin disposal or replacement unmounts it, so the transient layout store cannot retain an identifier whose renderer has disappeared.

`ui-workspace` declares the nested `sidebar.workspaces.heading` slot with its existing localized Workspace label as fallback. The Mantur-only `ui-mantur-navigation` package fills all three extension points: a semantically named Features navigation group, the localized Projects heading, and the independent Skill and Recipe empty pages. The Recipe copy defines a Recipe as a proven creative example with a result sample, prompt template, reproducible operator parameters, model and operator details, and an estimated recreation cost, not as a general workflow template. It states that Recipes are free and that operator execution requires real-time quote confirmation before it starts. The visual navigation follows the approved layout without a visible Features heading; its accessible navigation name retains the group identity. The official profile does not compose this package.

## Alternatives considered

**Hardcode Mantur terminology and links in `ui-sidebar`.** This would leak deployment copy into the official shell and make every product-specific destination part of a shared package, so the product package owns the occupants instead.

**Render marketplace pages in `shell.overlay`.** That slot is a click-through floating layer and leaves the conversation reachable behind it. Treating it as primary navigation would give the wrong accessibility and layout behavior.

**Persist the selected marketplace route.** The requested default is the current conversation after every reload. Keeping selection in the existing transient layout store meets that behavior without a second route store.

## Consequences

The shared client gains two generic extension points and one transient page selector, while Mantur copy and page structure remain isolated in one product package. Only one root-page occupant can be composed at a time. This MVP presents the Recipe definition and pricing rule but deliberately provides no catalog request, Skill installation, operator execution, quote confirmation, payment, or route persistence.
