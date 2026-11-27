# Roadmap

Owned by `product-manager`. Each task fits one Claude Code session and says how
"done" is verified. `/build-task` picks the first `ready` task from the top.

Status: `ready` · `in-progress (PR link)` · `review (PR link)` · `blocked (why)` · `done (PR link)` · `ceo` (needs the CEO, not code)

> Seeded on 2026-11-27 from the repo and the earlier planning brief. The first
> `/sprint-plan` must re-verify every item against the live services and the
> code, and correct it. Strategy: **web app first, €0 budget** (`CHARTER.md`).

## Now — web launch blockers

| ID | Task | Done when | Verified by | Status |
|---|---|---|---|---|
| R1 | Confirm the nightly refresh runs green **on its schedule** | 3 consecutive green scheduled `refresh-data` runs | Actions run history | in-progress (2026-11-27: secret set, 2 manual runs green; no scheduled run has fired since 2026-10-26 — watch) |
| R2 | Confirm Render auto-deploy ("After CI Checks Pass") and that `/health` reports `main`'s commit | `/health.commit` = `main` HEAD after a merge | `curl /health` | in-progress (2026-11-27: `/health` shows `79891f1`, the PR #5 merge, so auto-deploy worked once; confirm PR #6 lands too) |
| R3 | Pick the free web host and write the setup (recommendation: **Cloudflare Pages** — free, unlimited bandwidth, preview per PR; Vercel Hobby is the fallback). Add `DEPLOY.md` steps + `CLIENT_URL` CORS change | doc reviewed; CEO does the one-time connect | review | ready |
| R4 | Make the client a proper PWA: manifest, icons, service worker caching the last exhibition list, offline/"waking up the server" state for Render cold starts | installable on Android Chrome and iOS Safari; map never blank on a cold API | Lighthouse PWA + client test + phone check | ready |
| R5 | Hide shows past their end date everywhere in the API | no exhibition with `endsOn < today` in `/api/cities/milan/exhibitions` | server test + live check | done (already in `cities.ts`, opt-in `includeEnded`; live check 2026-11-27: 0 of 79 expired) |
| R6 | Per-source scrape report: rows found / upserted / failed per source, printed by `refresh.sh` | each nightly run shows per-source counts | workflow log | ready |
| R7 | Fix the degraded scrape sources (see `DEPLOY.md`), one per task | source returns ≥ its venue's current shows | `/data-health` + unit test on a saved HTML fixture | ready |
| R8 | Shareable URLs: every show and venue has its own route (`/e/:id`, `/v/:id`) with title/description/OG tags | a pasted link opens the show and previews in WhatsApp/Telegram | client test + manual paste | ready |
| R9 | Privacy page + cookie-free analytics statement, matching what telemetry actually collects | page linked from the app; reviewed by `legal-privacy` | review | ready |
| R10 | Web reminders: check whether the current local reminders work on the web; if not, fall back to "add to calendar" (.ics) | a user can get reminded of a closing show on web | client test + phone check | ready |

## Next — worth opening twice

| ID | Task | Done when | Verified by | Status |
|---|---|---|---|---|
| R11 | Coverage list: the 40 most-visited Milan venues with a source for each (or "none") | `company/coverage.md` exists | review | ready |
| R12 | "This weekend" and "Closing soon" views | both filters in the list and on the map | client tests + phone check | ready |
| R13 | Retention metric in `telemetry:report` (week-1 → week-2 return) | report prints T3 | server test | ready |
| R14 | Italian/English UI parity | every string in both languages | client test for missing keys | ready |
| R15 | SEO basics: indexable pages for venues and current shows, sitemap | sitemap lists current shows; pages render meaningful HTML | build check | ready |

## Later

- Google Play release — only at the store trigger in `CHARTER.md`. iOS after.
- Venue self-submission form (galleries add their own shows) — if coverage stalls.
- Custom domain — a CEO cost decision (~€10/yr); the free `*.pages.dev` URL is fine to launch.
- Second city — not this quarter.
