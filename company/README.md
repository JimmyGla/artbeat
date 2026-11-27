# ArtBeat, the company

> **CEO: read [STATUS.md](STATUS.md) first.** It's the one-page view of where
> we're going and what's done, updated every Monday and Friday.

ArtBeat is run like a small startup. The founder (you) is the CEO and the only
human. Everyone else is a Claude agent defined in `.claude/agents/`, and the
team's rituals are skills in `.claude/skills/`.

## Org chart

```
                          CEO (founder, human)
                                  │
                 Chief of staff = the main Claude session
          (runs the rituals, delegates to employees, batches decisions)
                                  │
   ┌───────────────┬──────────────┼───────────────┬─────────────────┐
 Product         Engineering     Content         Go-to-market     Risk
 product-manager engineer        data-editor     growth-marketer  legal-privacy
 designer        qa-reviewer     analyst
                 sre
```

| Employee | Owns | May write | Model |
|---|---|---|---|
| `product-manager` | `ROADMAP.md`, specs, priorities, task sizing | `company/` | sonnet |
| `designer` | UX, accessibility, store screenshots brief | `company/`, UI code on a branch | sonnet |
| `engineer` | Implementing roadmap tasks, tests | code on an `agent/*` branch | inherit |
| `qa-reviewer` | Reviewing every PR against `CLAUDE.md` rules | nothing (reports) | inherit |
| `sre` | Uptime, deploys, CI, Supabase/Render health | nothing (reports) | sonnet |
| `data-editor` | Scraper sources, coverage, freshness, data quality | `server/scripts/` on a branch | inherit |
| `analyst` | Metrics vs the charter's targets | `company/reports/` | sonnet |
| `growth-marketer` | Distribution in Milan, store listing, partnerships | `company/growth/` | sonnet |
| `legal-privacy` | GDPR, scraping terms, App Store/Play review | `company/` | sonnet |

## Rituals (skills)

| Command | When | Who | Output |
|---|---|---|---|
| `/standup` | daily, 08:00 | sre + data-editor | 10-line status in the session; no commits |
| `/sprint-plan` | Monday | product-manager (+ analyst) | updated `ROADMAP.md` on a company PR |
| `/build-task [id]` | nightly, or on demand | engineer → qa-reviewer | one PR per task |
| `/data-health` | Wednesday | data-editor | coverage report; fixes as a PR |
| `/weekly-review` | Friday | analyst, growth, legal, PM | `CEO_INBOX.md` + report on a company PR |
| `/launch-check` | before any store release | everyone | go / no-go with blockers |

Schedules live in [ROUTINES.md](ROUTINES.md).

## Operating rules (every employee follows these)

1. **The CEO merges.** Agents branch, commit, push and open PRs. They never
   merge, never push to `main`, never enable auto-merge. A merge to `main`
   auto-deploys the API, so a merge is a release decision.
2. **Production is read-only.** Render, Supabase, GitHub settings/secrets and
   the app stores are never changed by an agent. Reading public endpoints
   (`/health`, `/ready`, `/api/*`) and read-only dashboards is fine. Anything
   that changes a shared service goes into `CEO_INBOX.md` as a request.
3. **`CLAUDE.md` is law.** Its "Rules that are easy to break" are checked on
   every PR by `qa-reviewer`.
4. **The CEO reviews 2–3 times a week (about 3–4 h).** So:
   - At most **3 open agent code PRs** at a time. If three are waiting, nobody
     starts a fourth; they improve the open ones or do research instead.
   - Decisions are batched into `CEO_INBOX.md` once a week, each with a
     recommendation and a default that happens if the CEO says nothing.
   - A PR must be reviewable in 10 minutes: one task, small diff, a "How to
     verify" section.
5. **Measure, don't guess.** Claims about users, coverage or freshness cite a
   number and where it came from. "Unknown" is an allowed answer; an invented
   number is not.
6. **Write it down.** Decisions go in `DECISIONS.md`; work goes in
   `ROADMAP.md`. Agents don't carry memory between sessions — these files are
   the company's memory.

## Branch and PR conventions

- Branch: `agent/<role>/<task-id>-<slug>`, e.g. `agent/engineer/R12-share-link`.
- Company-doc PRs: `agent/company/<yyyy>-w<week>`.
- PR title: `<type>(<area>): <summary> [<task-id>]`.
- PR body: what & why, task link, **How to verify**, risks, and the
  `qa-reviewer` verdict.
