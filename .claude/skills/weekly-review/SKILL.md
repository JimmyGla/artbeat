---
name: weekly-review
description: ArtBeat Friday review — what shipped, metrics vs targets, growth and risk updates, and one batched CEO inbox of decisions with recommendations and defaults. Use when the user types /weekly-review, asks for "the week in review" or "what do you need from me?", or the Friday routine runs.
---

# Weekly review

The one place the CEO spends their time each week. Make it decidable in
30 minutes.

1. In parallel (Agent tool, one message):
   - `analyst`: update this week's metrics report (or create it).
   - `growth-marketer`: what to do next week to get users (≤ 3 actions, each
     with a ready-to-post draft in `company/growth/`), given current metrics.
   - `legal-privacy`: anything that changed this week (new sources, telemetry,
     launch steps) that carries risk; "nothing new" is fine.
2. Yourself: list PRs merged this week (`git log origin/main --since="7 days
   ago" --merges --oneline`), agent PRs still waiting, and roadmap progress.
3. Rewrite `company/CEO_INBOX.md`: move answered items (check
   `DECISIONS.md` and merged PRs) to "Answered"; list open items, most
   important first. Each item: the question · recommendation · **default if
   no answer by next Friday** · minutes it takes. Max 5; if there are more,
   the rest wait.
4. Write `company/reports/<yyyy>-w<week>-review.md`: shipped, metrics table,
   what we learned, next week's focus.
5. Commit to this week's `agent/company/<yyyy>-w<week>` branch (reuse its PR
   if open, else open `company: week <yyyy>-w<week> review`).
6. Report: 3-line summary, the inbox items, the PRs to review in order, the
   PR link.
