# ArtBeat

Map of art exhibitions in Milan. Three parts, each its own npm package (no
workspaces): `server/` (Express + Prisma API), `client/` (Vite + React web app,
wrapped by Capacitor for iOS and Android), and the scraper in `server/scripts/`.

## The team

ArtBeat is run like a startup by Claude agents, with the founder as CEO.
Org chart, operating rules and rituals: `company/README.md`. Goal and
targets: `company/CHARTER.md` (web app first, €0 budget). Work queue:
`company/ROADMAP.md`. Employees are in `.claude/agents/`, rituals
(`/standup`, `/sprint-plan`, `/build-task`, `/data-health`,
`/weekly-review`, `/launch-check`) in `.claude/skills/`. Agents open PRs;
only the CEO merges.

## Commands

Run inside `server/` or `client/` (the root `package.json` only forwards a few).

| | server | client |
|---|---|---|
| Install | `npm ci` | `npm ci` |
| Dev | `npm run dev` (port 3001) | `npm run dev` (port 5173) |
| Typecheck | `npm run typecheck` (src + scripts) | `npm run typecheck` |
| Lint | `npm run lint` | `npm run lint` |
| Test | `npm test` | `npm test` |
| Build | `npm run build` | `npm run build` |

Before saying a change is done, run typecheck, lint and test in every package
you touched. CI runs the same, plus `npm audit --omit=dev --audit-level=high`
and a Docker build + boot of the API image.

## How code reaches users

- **API:** merge to `main` → CI passes → Render auto-deploys (trigger "After
  CI Checks Pass"). Its build command runs `prisma migrate deploy` before the
  new code goes live; `/health` reports the live `commit`. Nothing else
  deploys. Never deploy from a laptop.
- **Database:** Supabase (Postgres 17, PostGIS). Production `DATABASE_URL` is
  the **pooler** URI, session mode; the direct host is IPv6-only.
- **Data:** `.github/workflows/refresh-data.yml` scrapes nightly.
- **Health:** `.github/workflows/uptime.yml` checks `/health` and `/ready`
  every 30 minutes. `/health` never touches the database; `/ready` does.
- **Mobile apps:** built by hand (below), not by CI.

Details and one-time setup: `DEPLOY.md`.

## Rules that are easy to break

- **Migrations run before the new code goes live**, so the old code briefly
  runs on the new schema. Add before you remove: new columns/tables in one
  release, drop old ones in a later one. A rename needs the code that uses
  both names first.
- **Write renames by hand.** `prisma migrate dev` turns a table, column or
  enum rename into DROP + CREATE, deleting the data. See
  `server/prisma/migrations/*rename*` for the pattern.
- **Never edit an applied migration.** Add a new one.
- **Every new table gets `ENABLE ROW LEVEL SECURITY` in its migration**, with
  no policies. Supabase serves `public` tables over its own data API to anyone
  with the anon key; the app doesn't use that API (Prisma connects as the
  owner, which RLS doesn't restrict), so it stays shut.
- **The `prisma` CLI is a production dependency** on purpose: the release step
  runs `npx prisma migrate deploy` in the image.
- **Secrets never go in the client.** Only `VITE_*` values reach the bundle,
  and they're public. The Supabase service-role key is server-only.
- **The public telemetry endpoint's schema is a privacy boundary**
  (`server/src/routes/telemetry.ts`, tested in `telemetrySchema.test.ts`).
  Props are scalars only; don't loosen it.
- **Opening hours are never guessed.** No data means no "Open now", not a
  default.

## Mobile builds

- `client/.env` sets `VITE_PROD_API_URL`, which native builds call. It's
  inlined at build time: changing it means rebuilding.
- `npm run build:mobile` builds and runs `cap sync`. `npm run build:device`
  first points `VITE_PROD_API_URL` at this machine's LAN IP (only if it's
  already a private address).
- **iOS needs a Mac with Xcode.** Android works anywhere with Android Studio
  (`npx cap open android` from `client/`).
- A Capacitor version bump also changes the pin in
  `client/ios/App/CapApp-SPM/Package.swift`; run `cap sync` and commit it.
  Test on a real device before merging.
- On Windows, `cap sync` rewrites two Android Gradle files with only
  whitespace changes. Don't commit those.

## Repo quirks

- Most files are LF, but `server/scripts/dateParser.ts`,
  `server/src/lib/errors.ts`, `server/src/lib/prisma.ts` and
  `server/src/routes/categories.ts` are stored with CRLF. On Windows with
  `core.autocrlf=true`, staging an edit to them normally rewrites every line.
  Stage those with `git hash-object -w --no-filters` + `git update-index` so
  only the real lines change.
- `client/package-lock.json` must be generated with **npm 10** (CI's Node 20),
  e.g. `npx npm@10 install`. npm 11 leaves out platform packages and CI's
  `npm ci` then fails.
- `server/.env` and `client/.env` aren't in git; copy from `.env.example`.
