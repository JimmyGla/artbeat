# CEO inbox

Rewritten every Friday by `/weekly-review`. Everything the team needs from the
CEO, in one place, so a week's decisions take one sitting.

Each item: what's asked · the team's recommendation · **what happens if you
don't answer** · time it takes you.

## Open

_Nothing right now._ Next expected: the one-time "connect repo" on
Cloudflare Pages, once the R3 setup PR lands (~10 min).

## Being watched (no action yet)

- **Can the cloud routines open PRs themselves?** We'll know after tonight's
  review. If not, they leave you a one-click "compare" link, and the team
  will tell you what to connect so they can.
- **Nightly data refresh (R1):** works when run by hand, but GitHub hasn't
  fired the 04:15 UTC schedule since 26 Oct. The standup reports it daily; if
  it still hasn't fired by Monday, the team will propose a fix.
- **Auto-deploy (R2):** worked for PR #5; the API was still on that build
  after PRs #6 and #7 merged. The standup checks it.

## Answered

- 2026-11-27 — Charter targets T1–T5: confirmed as proposed.
- 2026-11-27 — Web host: Cloudflare Pages.
- 2026-11-27 — Merge the `agent-team` PR and create the routines: done (PR #6, five routines live).
