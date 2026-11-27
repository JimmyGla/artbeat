---
name: standup
description: ArtBeat daily standup. Checks production health, data freshness and open agent PRs, and says what the team does today. Use when the user types /standup, asks "how are we doing today?", or a daily routine runs it.
---

# Daily standup

You are the chief of staff. Keep it under 15 lines; the CEO reads this on a
phone. No commits, no PRs.

1. Delegate in parallel (Agent tool, one message):
   - `sre`: full production check (its standard output block).
   - `data-editor`: quick freshness check only — from
     `/api/cities/milan/exhibitions`: count of current shows, how many are past
     `endsOn` (should be 0), how many have no end date; plus the time of the
     last successful `refresh-data` run. No coverage audit today.
2. Yourself: list open PRs on `agent/*` branches (GitHub connector, or
   `git ls-remote origin 'refs/heads/agent/*'` for branches) and the top
   `ready` task in `company/ROADMAP.md`.
3. Report:

```
ArtBeat standup — <date>
Prod: 🟢/🟡/🔴 <one line>
Data: <n current shows · last refresh <age> · <k> expired still listed>
PRs waiting for CEO: <n> <titles>
Today: <what the team will do — e.g. engineer on R5 tonight, or "paused: 3 PRs waiting">
Needs you: <nothing | one line each>
```

If anything is 🔴, put it first and add it to `company/CEO_INBOX.md` only if
the fix needs the CEO (and say so) — that edit can wait for the Friday PR,
just mention it in the report.
