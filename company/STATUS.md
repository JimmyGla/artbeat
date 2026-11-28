# ArtBeat — where we are

**Start here.** One page, rewritten by `/sprint-plan` (Monday) and
`/weekly-review` (Friday). Details live in the files linked below.

_Last updated: 2026-11-28 (Friday review)_

## Where we're going

**Web launch ~14 Dec 2026 · user targets by late Jan 2027 · deadline 28 Feb 2027.**

**Goal:** real people in Milan using ArtBeat as a free web app
(details: [CHARTER.md](CHARTER.md)).

| Target | Goal | Now | |
|---|---|---|---|
| T1 Web app live & shareable | public URL, installable | host chosen (Cloudflare Pages), setup is R3 | 🔴 |
| T2 Weekly active users | ≥ 100 | unknown: telemetry not read yet | ⚪ |
| T3 Week-2 return rate | ≥ 25% | not measured yet (R13) | ⚪ |
| T4 Coverage of the top 40 venues | ≥ 80% | not measured yet (R11); 78 shows live | ⚪ |
| T5 Fresh data every night | 6 of 7 nights | the nightly schedule fired again on 27 Nov and succeeded (first since 26 Oct); needs a streak | 🟡 |

🟢 on track · 🟡 at risk · 🔴 not started / blocked · ⚪ unknown

## Launch progress

`█░░░░░░░░░` **1 of 10** launch blockers done ([ROADMAP.md](ROADMAP.md), "Now")

| Done | In progress | Next up |
|---|---|---|
| R5 ended shows hidden | R1 nightly refresh · R2 auto-deploy | R3 free web host · R4 PWA · R6 per-source scrape report |

## What happened recently

- **28 Nov:** weekly review. Arte.it venue and geocoding fixes merged (PRs #10, #11); a scheduled data refresh ran green on 27 Nov. Risks: no privacy page yet, web host not set up (R3).
- **27 Nov:** the agent team was set up (PRs #6, #7). Strategy: web app first, €0 budget. Targets confirmed; Cloudflare Pages chosen.
- **26–27 Nov:** `DATABASE_URL` secret added; two manual data refreshes succeeded; 79 Milan shows live.
- **Earlier:** the arte.it scraper now crawls the whole Milan listing (PR #5); the refresh workflow fixed (PRs #3, #4).

## What we need from you

See [CEO_INBOX.md](CEO_INBOX.md): 5 small items, mostly defaults. Biggest: the privacy page the app links to doesn't exist yet, and the Cloudflare Pages connect (~10 min) once the R3 PR lands.

## Production right now

API 🟢 up · DB 🟢 ready · last scheduled data refresh 27 Nov 13:49 UTC ✅ · deployed `c24b099` (main is `6498d27`, deploy catching up)
