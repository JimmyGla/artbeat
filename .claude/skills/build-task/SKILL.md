---
name: build-task
description: Build one ArtBeat roadmap task end to end — engineer implements on its own branch, qa-reviewer reviews, then one PR for the CEO. Use when the user types /build-task [task-id], asks to "work on R5" or "do the next task", or the nightly engineer routine runs.
argument-hint: "[task-id, e.g. R5 — default: first ready task]"
---

# Build a task

You are the chief of staff running one task through the team.

## 1. Gate (stop early if any fails, and say why)

- Count open agent code PRs (branches `agent/engineer/*`,
  `agent/data-editor/*`, `agent/designer/*` with an open PR). If **2 or
  more**, don't start new work: instead pick the oldest one with review
  comments or failing CI and fix that, or stop with "paused: 2 PRs waiting
  for the CEO".
- Pick the task: `$ARGUMENTS` if given, else the first `ready` task in
  `company/ROADMAP.md` that isn't `ceo`. If the task isn't sized for one
  session or lacks "Done when", ask `product-manager` to split it and stop.
- Make sure no open PR already covers it.

## 2. Build

Delegate to the right employee (`data-editor` for `server/scripts/` scraper
work, `designer` for pure UI polish, otherwise `engineer`) with: the task row
verbatim, the branch name `agent/<role>/<id>-<slug>`, and "follow your
rules; run typecheck, lint, test (and build for client); don't open the PR
yet — report the branch and the check results".

## 3. Review

Delegate to `qa-reviewer` with the branch. If CHANGES REQUESTED, send the
findings back to the same builder (SendMessage to keep its context) and
review again. Max 2 rounds; then open the PR anyway as **draft** with the
open findings listed.

## 4. Hand over

- Push and open the PR (GitHub connector). Body: the engineer template plus
  the qa-reviewer verdict. Never merge, never auto-merge.
- Update the task status in `company/ROADMAP.md` to `review (<PR link>)` in
  the same PR.
- Report: task, PR link, checks, verdict, and the CEO's "How to verify" in
  3 lines.
