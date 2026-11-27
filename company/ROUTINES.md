# Routines (the team's schedule)

Cloud routines run these rituals on a schedule, from the repo's `main`
branch, so they only work once `.claude/agents/`, `.claude/skills/` and
`company/` are merged. Times are Europe/Rome. "Busy schedule", ~15 runs a
week.

| Routine | When (cron, Europe/Rome) | Prompt | Writes |
|---|---|---|---|
| `artbeat-standup` | daily 08:00 (`0 8 * * *`) | Run the /standup skill. | nothing |
| `artbeat-sprint-plan` | Mon 08:30 (`30 8 * * 1`) | Run the /sprint-plan skill. | company PR |
| `artbeat-data-health` | Wed 08:30 (`30 8 * * 3`) | Run the /data-health skill. | company PR (same week branch) |
| `artbeat-weekly-review` | Fri 17:00 (`0 17 * * 5`) | Run the /weekly-review skill. | company PR (same week branch) |
| `artbeat-nightly-engineer` | Sun–Thu 23:00 (`0 23 * * 0-4`) | Run the /build-task skill with no argument. | ≤ 1 code PR, paused when 3 are waiting |

Every routine prompt also starts with:

> You are an ArtBeat employee working unattended. Follow `CLAUDE.md` and
> `company/README.md`. Never merge, never push to `main`, never change
> Render, Supabase, GitHub settings or secrets. No local `.env` exists here:
> use only public endpoints and say "not reachable" for anything that needs a
> secret.

## Connectors

Only `artbeat-standup` and `artbeat-sprint-plan` have connectors: Render and
Supabase, each limited to a list of read-only tools (status, deploys, logs,
metrics, advisors) and told never to change anything. The other three have
none. Decided 2026-11-27 (see `DECISIONS.md`).

## What the routines can't do

- **Read telemetry or run `db:audit`** — they need `DATABASE_URL`, which stays
  out of the cloud. Run `/weekly-review` locally once in a while (with
  `server/.env`) to get real usage numbers into the report.
- **Phone checks** — the CEO does those from the PR's "How to verify".

## Your weekly loop as CEO (≈ 1–2 hours)

1. Friday evening: read `company/CEO_INBOX.md`, answer in the review PR's
   comments or edit the file, and merge the company PR.
2. Review and merge the (at most 2) code PRs, using each one's "How to
   verify". Merging to `main` deploys the API.
3. That's it. Standups are there if you want them; nothing waits on them.

## Pausing the team

Turn the routines off in claude.ai (Routines), or ask any session to "pause
the ArtBeat routines". Code PRs stop on their own when 3 are waiting.
