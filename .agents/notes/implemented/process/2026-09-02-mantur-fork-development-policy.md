# Agent Note: Mantur fork development policy

Status: implemented

English | [中文](2026-09-02-mantur-fork-development-policy.zh.md)

## Problem

The Mantur edition adds drama-production behavior to DeepSeek Harness while continuing to receive official DSH updates. Without explicit ownership and Git rules, ordinary feature work can drift into official core modules, accumulate a private patch set, or make an upstream merge indistinguishable from a product change. Vague commit messages also force maintainers to inspect a diff before they can understand the history.

## Decision

The fork keeps `origin/main` as its stable drama branch. A local `master` branch tracks `upstream/master` as the official DSH baseline. Feature and defect work uses `feat/<topic>` and `fix/<topic>` branches, and shared branches receive updates through merges so published history is not rewritten.

Drama behavior belongs first in plugins, Skills, profile or configuration overlays, and documented extension points. A change to official core code is permitted only when those mechanisms cannot express the verified requirement. That change records why the extension points are insufficient, which upstream-owned files are affected, and how the next upstream merge is verified.

Each branch contains one reviewable feature or fix. Its code, focused evidence, documentation, and required Agent Note move together. Unrelated cleanup and speculative infrastructure stay out of the change.

Every commit title uses `<type>(<scope>): <plain outcome>`, with the scope omitted when it adds no useful information. The title names the actual result in everyday language. A commit whose result is not clear from the title adds a short body with `Changed:` and `Why:`. Generic titles such as `update`, `misc`, `fix stuff`, and `WIP` are not accepted.

## Verification

Before publication, the author inspects the complete diff, runs the narrowest checks that cover it through the repository pre-push workflow, and reports any check that was not run. An upstream update merges from `upstream/master` into local `master`, then into `main`; the fork publishes only after the selected checks pass.

## Alternatives considered

**Modify official core whenever it is faster.** This can shorten one implementation but expands the conflict area for every DSH update and hides which behavior belongs to Mantur.

**Keep only the Fork remote.** This makes official updates harder to identify and weakens the distinction between the DSH baseline and drama work.

**Allow unrestricted commit titles.** Git accepts them, but maintainers cannot scan, review, or revert history without reopening each diff.

## Consequences

- Most drama work remains isolated from upstream-owned code, so official updates usually merge across a small and visible change area.
- Core changes require explicit evidence and carry additional upgrade verification.
- The local repository keeps both `main` and `master`, with different owners and purposes.
- Commit authors spend a small amount of time describing the result so later maintainers can understand history directly.
