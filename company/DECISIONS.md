# Decisions

Newest first. One entry per decision: date, decision, why, who decided. Agents
append here when the CEO answers something in `CEO_INBOX.md`.

## 2026-11-27 — Routines get read-only visibility only

- **Decision:** the standup and sprint-plan routines may read Render and
  Supabase (allow-listed read tools only). No routine can change a service.
- **Why:** routines run unattended; a write mistake would hit production
  with nobody watching. Service changes stay in the CEO inbox.
- **Decided by:** CEO.

## 2026-11-27 — Web app first, €0 budget

- **Decision:** launch as a free-hosted, installable web app (PWA). App store
  releases wait for the store trigger in `CHARTER.md` (Google Play first).
- **Why:** store fees and review add cost and delay before we know anyone
  returns; the web app can be shared by link, which is how it will spread.
- **Decided by:** CEO.

## 2026-11-27 — Run ArtBeat with an agent team

- **Decision:** a team of Claude subagents and scheduled routines does the
  day-to-day work; the CEO reviews and merges.
- **Goal:** real users in Milan in 3 months (see `CHARTER.md`).
- **Autonomy:** agents open PRs, the CEO merges. Production services are
  read-only for agents.
- **Cadence:** busy schedule (daily standup, nightly engineer, weekly planning
  and review). CEO time under 5 h/week, so at most 2 open agent code PRs.
- **Decided by:** CEO.

## Earlier (from the planning brief)

- Keep Render + Supabase; deploy only from CI; migrations run before code.
  A Terraform / Cloud Run setup was rejected as too heavy for one person.
