# CEO inbox

Rewritten every Friday by `/weekly-review`. Everything the team needs from the
CEO, in one place, so a week's decisions take one sitting.

Each item: what's asked · the team's recommendation · **what happens if you
don't answer** · time it takes you.

## Open

1. **Confirm the charter targets** (`CHARTER.md`, T1–T5). Recommendation: keep
   them. Default if no answer: they stand. ~5 min.
2. **R3: approve Cloudflare Pages as the free web host.** Recommendation:
   yes (free, unlimited bandwidth, a preview URL per PR). Default: the
   engineer writes the setup for Cloudflare Pages, and you do the one-time
   "connect repo" click when that PR lands. ~2 min now, ~10 min later.
## Being watched (no action yet)

- **Can the cloud routines open PRs themselves?** We'll know after tonight's
  review. If not, they leave you a one-click "compare" link, and the team
  will tell you what to connect so they can.
- **Nightly data refresh (R1):** works when run by hand, but GitHub hasn't
  fired the 04:15 UTC schedule since 26 Oct. The standup reports it daily; if
  it still hasn't fired by Monday, the team will propose a fix.
- **Auto-deploy (R2):** worked for PR #5; the standup checks that PR #6 landed.

## Answered

- 2026-11-27 — Merge the `agent-team` PR and create the routines: done (PR #6, five routines live).
