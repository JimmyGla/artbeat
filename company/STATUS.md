# ArtBeat — where we are

**Start here.** One page, rewritten by `/sprint-plan` (Monday) and
`/weekly-review` (Friday). Details live in the files linked below.

_Last updated: 2026-11-27 (setup day)_

## Where we're going

**Goal by 28 Feb 2027:** real people in Milan using ArtBeat as a free web app
(details: [CHARTER.md](CHARTER.md)).

| Target | Goal | Now | |
|---|---|---|---|
| T1 Web app live & shareable | public URL, installable | host chosen (Cloudflare Pages), setup is R3 | 🔴 |
| T2 Weekly active users | ≥ 100 | unknown: telemetry not read yet | ⚪ |
| T3 Week-2 return rate | ≥ 25% | not measured yet (R13) | ⚪ |
| T4 Coverage of the top 40 venues | ≥ 80% | not measured yet (R11); 79 shows at 29 venues live | ⚪ |
| T5 Fresh data every night | 6 of 7 nights | refresh works when started by hand; the nightly schedule hasn't fired since 26 Oct | 🟡 |

🟢 on track · 🟡 at risk · 🔴 not started / blocked · ⚪ unknown

## Launch progress

`█░░░░░░░░░` **1 of 10** launch blockers done ([ROADMAP.md](ROADMAP.md), "Now")

| Done | In progress | Next up |
|---|---|---|
| R5 ended shows hidden | R1 nightly refresh · R2 auto-deploy | R3 free web host · R4 PWA · R6 per-source scrape report |

## What happened recently

- **27 Nov:** the agent team was set up (PRs #6, #7). Strategy: web app first, €0 budget. Targets confirmed; Cloudflare Pages chosen.
- **26–27 Nov:** `DATABASE_URL` secret added; two manual data refreshes succeeded; 79 Milan shows live.
- **Earlier:** the arte.it scraper now crawls the whole Milan listing (PR #5); the refresh workflow fixed (PRs #3, #4).

## What we need from you

See [CEO_INBOX.md](CEO_INBOX.md). Right now: **nothing** — next is a ~10 min Cloudflare Pages connect when the R3 PR lands.

## Production right now

API 🟢 up · DB 🟢 ready · last data refresh 27 Nov 09:03 UTC ✅ · deployed `79891f1`
