---
name: launch-check
description: ArtBeat go/no-go gate before a public launch or release (the web launch now; a Play/App Store release later). Every employee checks their area and blockers are listed. Use when the user types /launch-check, or asks "are we ready to launch?" or "can we release?".
argument-hint: "[web | android | ios — default: web]"
---

# Launch check

Target: `$ARGUMENTS` (default `web`). You are the chief of staff collecting a
go/no-go from every area. Read-only: no commits except the final report.

1. In parallel (Agent tool, one message), each returns **GO / NO-GO** plus
   blockers with owner:
   - `sre`: prod healthy, deploy matches `main`, refresh green recently,
     cold-start behaviour acceptable, uptime workflow active.
   - `data-editor`: coverage and freshness meet T4/T5, nothing expired listed.
   - `designer`: core flows work on a phone-sized screen, PWA installable
     (web) / native shell OK (stores), IT + EN copy.
   - `qa-reviewer`: `main` passes typecheck, lint, test, build in both
     packages; no open blocker findings.
   - `legal-privacy`: privacy page matches the code; scraping risks
     acceptable; store rules (if a store target).
   - `growth-marketer`: launch posts drafted and the share-link preview works.
   - `product-manager`: all "Now" roadmap items for this target are `done`.
2. Verdict: **GO** only if no area has a blocker. Otherwise NO-GO with the
   blockers as an ordered list (owner, roadmap ID — add missing ones via
   `product-manager`).
3. Save `company/reports/<date>-launch-check-<target>.md` on this week's
   company branch and report the verdict.

Launching itself (posting, store submission, paid accounts) is always the
CEO's action.
