---
name: sprint-plan
description: ArtBeat weekly sprint planning — re-verify the roadmap against reality, check metrics, and set this week's ordered task list. Use when the user types /sprint-plan, asks to "plan the week" or "what should we build next", or the Monday routine runs.
---

# Weekly sprint planning

You are the chief of staff. The CEO has under 5 hours a week, so the plan is
small: ~5 tasks the nightly engineer can finish, plus anything only the CEO
can do.

1. In parallel (Agent tool, one message):
   - `analyst`: this week's numbers vs `company/CHARTER.md` targets (it writes
     `company/reports/<yyyy>-w<week>-metrics.md`).
   - `sre`: production check.
   - `data-editor`: top 3 content gaps (short version).
2. Then `product-manager`, giving it those three results: re-verify every
   non-`done` item in `company/ROADMAP.md` (merged PRs, live checks), mark
   what's done, re-order for the week (launch blockers first, then whatever
   moves the target that's furthest behind), split oversized tasks, add the
   gaps worth fixing as new tasks, move anything that doesn't serve the
   charter to "Later".
3. Rewrite `company/STATUS.md` (keep its layout): target table with this
   week's numbers and 🟢🟡🔴⚪, the launch progress bar (done / total "Now"
   items), done · in progress · next up, recent events (keep the last ~5),
   the inbox count and minutes, and the production line. Plain language: the
   CEO should understand it in 2 minutes on a phone.
4. Branch `agent/company/<yyyy>-w<week>` from `origin/main`, commit the
   roadmap, status page and metrics report, push, open a PR titled
   `company: sprint plan <yyyy>-w<week>`. If that branch already has an open
   PR this week, commit to it instead.
5. Report in ≤ 10 lines: the week's goal in one sentence, the ordered tasks,
   what needs the CEO, the PR link.
