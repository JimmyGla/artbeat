# Weekly review 2026-w48 (28 Nov 2026)

## Shipped (merged to `main`, 21–28 Nov)

- PR #2 DB lockdown, #3/#4 refresh runner fixes, #5 arte.it whole-Milan crawl
- PR #6/#7 the agent team and STATUS page, #8 CEO answers, #9 fast plan
- PR #10 arte.it venue lines and clean titles, #11 geocoding outside Milan and by name

No agent PRs are open. Roadmap: R5 done; R1 and R2 in progress; R3, R4, R6–R10 not started.

## Metrics

See [2026-w48-metrics.md](2026-w48-metrics.md). In short: T1 not live; T2/T3
not reachable (no `DATABASE_URL` here); T4 no baseline (no `coverage.md`);
T5 first scheduled refresh in a month succeeded on 27 Nov, 0 of 78 shows
expired. API `/health` and `/ready` both 200.

## What we learned

- The schedule silently stopped for a month (26 Oct to 27 Nov). We need a
  nightly per-source success report (R6) so it can't hide.
- The app links to a privacy page that doesn't exist (legal-privacy).
- Nominatim's contact in the geocoder is a placeholder.
- Growth drafts exist (gallery emails, student-group posts) but all wait for a public URL.

## Next week's focus

1. R3 Cloudflare Pages setup, then R4 PWA and R8 shareable URLs.
2. R9 privacy page (legal drafts, engineer builds).
3. R11 coverage list (data-editor) to get a T4 baseline.
Max 3 open agent code PRs at once.
