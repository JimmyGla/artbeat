# CEO inbox

Rewritten every Friday by `/weekly-review`. Everything the team needs from the
CEO, in one place, so a week's decisions take one sitting.

Each item: what's asked · the team's recommendation · **what happens if you
don't answer** · time it takes you.

_Last rewritten: 2026-11-28 (week 48)._

## Open

1. **Privacy page before launch (R9).** The app links to
   `https://artbeat.app/privacy`, but no privacy page exists in the client or
   in `company/legal/`. Needs to be live by ~14 Dec.
   · Recommend: let `legal-privacy` draft it and the engineer serve it at
   `/privacy` on the free `*.pages.dev` URL (and point the in-app link there).
   · **Default:** the team does exactly that; you review the PR. · 10 min.
2. **Cloudflare Pages "connect repo" (R3).** Nobody has built R3 yet, so the
   web launch (14 Dec) is the tightest item. When the R3 PR lands, the
   one-time connect takes you ~10 min following `DEPLOY.md`.
   · Recommend: merge R3 as soon as it's reviewed.
   · **Default:** nothing for you to do until the PR exists; the nightly
   engineer builds R3 next. · 10 min (later).
3. **Gallery outreach and student-group posts (drafts ready).** Drafts are in
   `company/growth/`. They need the public URL, so earliest send is ~10 Dec;
   emails go from you.
   · Recommend: approve sending the gallery emails once R3 + R8 are live.
   · **Default:** nothing is sent. · 5 min to read.
4. **Telemetry numbers (T2, T3).** Routines have no `DATABASE_URL`, so weekly
   active users and return rate can't be measured by the team.
   · Recommend: once a week run `npm run telemetry:report` in `server/` on
   your machine and paste the output in a PR comment or to the team.
   · **Default:** T2 and T3 stay "unknown". · 3 min/week.
5. **Replace the Nominatim contact (engineer task).** The geocoder's
   User-Agent contact is the placeholder `https://github.com/artbeat`; the
   Nominatim policy wants a real contact. Recommend using a real project
   contact (your choice of email or repo URL). **Default:** the team uses the
   repo URL `https://github.com/JimmyGla/artbeat`. · 1 min.

## Being watched (no action yet)

- **Nightly data refresh (R1):** a scheduled run fired and succeeded on
  27 Nov (run #66), the first since 26 Oct. Needs 3 in a row; the standup
  checks it daily.
- **Auto-deploy (R2):** `/health` showed `c24b099` (PR #10) on 28 Nov while
  `main` is `6498d27` (PR #11), which had merged minutes earlier; checking
  again at the next standup.
- **Can routines open PRs themselves?** This run has GitHub tools, so yes.

## Answered

- 2026-11-27 — Charter targets T1–T5: confirmed as proposed.
- 2026-11-27 — Web host: Cloudflare Pages.
- 2026-11-27 — Merge the `agent-team` PR and create the routines: done (PR #6, five routines live).
- 2026-11-27 — Faster plan (web launch by 14 Dec, PR limit 3): merged (PR #9).
