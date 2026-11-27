---
name: data-health
description: ArtBeat weekly content audit — coverage of the top Milan venues, freshness, expired or broken listings, scraper source health — with fixes proposed as roadmap tasks. Use when the user types /data-health, asks "are we missing shows?" or "is the data fresh?", or the Wednesday routine runs.
---

# Data health

Content is the product. This ritual answers: what's on in Milan that ArtBeat
doesn't show, and what does ArtBeat show that's wrong?

1. Delegate to `data-editor`: full audit — public API counts, quality issues
   (expired, no end date, no venue, echoed descriptions, missing art form),
   and coverage against `company/coverage.md` (create or refresh it; sample
   at least the 15 busiest venues this week, rotating through the rest).
2. If it proposes a new scrape source or a site whose terms are unclear,
   delegate a quick check to `legal-privacy` (robots.txt + terms for that
   site only).
3. Commit the updated `company/coverage.md` and a report
   `company/reports/<yyyy>-w<week>-data.md` to this week's
   `agent/company/<yyyy>-w<week>` branch (create it from `origin/main` if
   needed; reuse its open PR if one exists). Add the top 3 gaps as roadmap
   tasks via `product-manager` in the same commit.
4. Report: coverage % for the sampled venues (T4), freshness verdict (T5),
   the top 3 gaps, PR link.

No scraper code changes in this ritual — fixes go through `/build-task`.
