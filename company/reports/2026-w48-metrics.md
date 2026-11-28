# Metrics 2026-w48 (measured 2026-11-28)

First report, so "Last week" is unknown for every target.

| Target | Goal | This week | Last week | Trend | Source |
|---|---|---|---|---|---|
| T1 Web app live, PWA, shareable | live by 2026-12-14 (M1) | Not live. Cloudflare Pages is not connected (R3 ready, R4 PWA ready). | unknown | n/a | company/STATUS.md and ROADMAP.md, 2026-11-28 |
| T2 Weekly active users | >= 100 | not reachable (telemetry needs DATABASE_URL, not available in this session) | unknown | n/a | none |
| T3 Week-2 return | >= 25% | not reachable (telemetry) | unknown | n/a | none |
| T4 Coverage at top 40 venues | >= 80% | unknown. company/coverage.md does not exist, so there is no checklist. | unknown | n/a | none |
| T5 Freshness: scrape success | every source >= 6 of 7 nights | Partial. Run #66 succeeded 2026-11-27 13:49Z. It was the first scheduled run since 26 Oct. Run #67 (manual) is in progress. A nightly success rate over 7 nights can't be computed. | unknown | n/a | figures supplied by the caller (not independently verified) |
| T5 Freshness: expired shows | 0 listed past end date | 0 of 78 have endsOn before 2026-11-28 | unknown | n/a | GET /api/cities/milan/exhibitions, 2026-11-28 |

Other checks, 2026-11-28:
- API /health: 200, commit c24b099f.
- /ready: 200, database up.
- Exhibitions endpoint: 200, 78 shows. This matches the caller's figure.

What moved: the scheduled refresh resumed on 27 Nov after a gap of about a month. The API and database are healthy.
What didn't: T1 is not live, and T2 and T3 can't be measured here. T4 has no baseline.
What I'd change:
- Prioritise R3 and R4 for M1 on 14 Dec.
- Ask the data-editor to create company/coverage.md.
- Run the telemetry report from a session that has a local server/.env.
- For T5, add a roadmap task to report nightly success per source over 7 days, because the Oct 26 to Nov 27 gap shows that the schedule can silently stop.
