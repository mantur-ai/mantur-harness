# Agent Note: The trigger menu keeps previous rows through refinement

Status: implemented

English | [中文](2026-08-28-trigger-menu-stale-while-revalidate.zh.md)

## Problem

Every keystroke inside an open `@`/`/` trigger menu launches a new candidates fetch. The menu reducer's `hit` case used to reseed the groups to pending-empty, so the list collapsed to a skeleton for the 100–460ms fetch round trip and repainted on every character — a visible flicker on each refinement keystroke (#3234).

## Decision

The reducer's `hit` case (`core/menu.ts`) now retains the previous query's rows and highlight, marking each group `pending` — stale-while-revalidate. Fresh opens (`seedGroups`) still start empty, so the first paint keeps its skeleton; `allReadyEmpty` still auto-closes after settle.

Stale rows are display-only. `pick()` requires the candidate's group to be `ready`, and the `enter` arbitration checks the highlighted group's status before picking: during the pending window Enter is an explicit no-op (`'consumed'`) — it neither picks the stale row nor falls through to submit the draft. Tab already carried the same `ready` check for drilling.

A source lexicon notification republishes the names and re-fetches an open menu in a microtask. The refresh guard follows the menu's logical `generation`, open state, and current hit instead of a `TriggerHit` object identity: a React render can project the same draft into an equivalent new object without creating a new menu generation. A real Web scenario installs a Skill into the active `DSH_HOME` and pins the complete filesystem watcher → Host event → Gateway stream → Client cache invalidation → open-menu refresh path.

## Alternatives considered

**Clear to a skeleton on every refinement.** Rejected; this was the flickering status quo. The production chat frontend's conversation search does clear (results and active index reset per debounced query), which keeps its Enter trivially safe — but its list is in a dedicated dialog, whereas this menu repaints directly under the caret on every keystroke, where the flicker is what users reported.

**Pass Enter through to submit during the pending window.** Rejected. Before this change the window showed an empty skeleton, so Enter falling through to send was visually consistent; with retained rows the user is looking at a highlighted candidate, and sending the whole draft under it is a worse mis-fire than a few hundred milliseconds of dead key. The production search's pending-window Enter is likewise a no-op.

**Queue the Enter and pick when the fetch settles.** Rejected. Acting on a keypress against rows the user has not seen yet reintroduces the stale-pick race with extra timing machinery.

**Guard an invalidation refresh with the captured `TriggerHit` object identity.** Rejected. Object identity is not the menu's logical generation: an equivalent draft projection can replace the object before the queued refresh runs and suppress a valid catalog update.

## Consequences

Refinement keystrokes do not flicker, and a source invalidation replaces rows in an already-open menu without another input gesture or page reload. The costs: Enter is dead for the pending window (pressing it again after settle picks normally), and rows are index-keyed, so a settle swaps DOM node content in place — pointer tests must wait for a stale-only row to disappear before clicking (`reference-composer.e2e.ts` polls `folderx/` away). A pre-existing highlight blink during refinement remains open and is deferred to a follow-up.
