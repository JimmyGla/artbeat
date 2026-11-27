# Charter

The document every employee plans against. Only the CEO changes the goal and
the targets; the product-manager may propose edits through `CEO_INBOX.md`.

## Mission

Be the app people in Milan open to decide which exhibition to see this week.

## The goal for the next 3 months (to 2027-02-28)

**Real users in Milan, on a €0 budget.** Launch as a **web app first**: a
public, installable PWA on a free host, and get people coming back. The App
Store and Google Play cost money (Apple €99/yr, Google $25) and add review
risk, so they wait until the web app proves people return (see "Store
trigger" below). Revenue comes later; anything that doesn't move users or
retention waits.

## Who it's for (working hypothesis, to validate)

1. **Milan residents who like art but don't follow the scene closely** — want
   "what's on near me / this weekend" without checking ten museum sites.
2. **Students and young professionals** (Brera, Politecnico, Bocconi, IULM,
   NABA) — free and cheap shows, openings, last-chance reminders.
3. **Visitors in Milan for a few days** — need English, a map and opening
   hours they can trust.

## Targets

Proposed by the team on 2026-11-27. **CEO: confirm or change these numbers**;
until then they stand.

| # | Target by 2027-02-28 | How it's measured |
|---|---|---|
| T1 | Web app live on a public URL, installable as a PWA, every show shareable by link | URL loads on a phone; Lighthouse PWA checks pass |
| T2 | ≥ 100 weekly active users | first-party telemetry (`npm run telemetry:report`) |
| T3 | ≥ 25% of week-1 users return in week 2 | telemetry, install cohort → later session |
| T4 | Coverage: ≥ 80% of current shows at the 40 most-visited Milan venues | `data-editor` checklist vs. the venues' own sites |
| T5 | Freshness: every source scraped successfully ≥ 6 of 7 nights; no listed show past its end date | refresh workflow runs + `/data-health` |

If a target can't be measured yet, the smallest thing that measures it is a
roadmap task, not a reason to skip the target.

## Constraints

- **CEO time:** under 5 hours a week. See the operating rules in `README.md`.
- **Budget: €0/month.** Free tiers only: Render free (API), Supabase free
  (DB), GitHub Actions, a free static host for the web app. Any cost at all —
  a domain, a paid tier, store fees — is a CEO decision raised through
  `CEO_INBOX.md` with the trigger that justifies it.
- **Free-tier limits to design around:** Render free sleeps after ~15 min idle
  (first request can take ~30–60 s), so the web app must show cached data or a
  friendly loading state, never a blank map. Supabase free pauses after a week
  without activity; the uptime workflow keeps it awake.
- **Store trigger:** propose Google Play first ($25 once, the Capacitor
  Android build already works) only when T2 and T3 are met for 2 weeks
  running. iOS after that.
- **Stack:** keep Render + Supabase, deploy only from CI. Revisit only with a
  concrete reason.
- **Privacy:** EU users. Collect the minimum; the telemetry schema is a
  privacy boundary.

## Out of scope this quarter

Other cities, app store releases (until the store trigger), user accounts
beyond what exists, social features, monetisation, anything that costs money.
