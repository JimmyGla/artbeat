# Deploying ArtBeat

Current, verified-where-possible checklist. The long-form walkthrough in
[docs/deployment-walkthrough.md](docs/deployment-walkthrough.md) covers platform
signup in more detail; this file is the accurate short path and takes
precedence where the two disagree.

Steps marked **[you]** need an account, a payment method, or a browser
session, so they can't be automated.

---

## What is already prepared

| Piece | State |
|---|---|
| `.github/workflows/ci.yml` | On push/PR: typecheck, ESLint, tests, production dependency audit, client build. Also builds the API image and boots it (see below). |
| `.github/workflows/refresh-data.yml` | Nightly scrape → repair → audit. Needs `DATABASE_URL` secret. |
| `server/Dockerfile` | Multi-stage, non-root, API-only. CI builds it and smoke-tests `/health`, `/ready` and the Prisma CLI on every PR. |
| `server/.dockerignore` | Excludes `scripts/`, `logs/`, `.env`. |
| `docker-compose.yml` | Local Postgres + PostGIS and the API image. Reads `server/.env`; migrate and seed from the host (see the file's header). |
| `GET /health` | Liveness. No DB access, safe for restart probes. |
| `GET /ready` | Readiness. Verifies Postgres. Verified against live Supabase. |
| `npm test` | Server: parsers, filters, opening hours, and the app's health/ready/404/CORS behaviour. Client: reminders, telemetry. |

Playwright was moved to `devDependencies` — the API never imports it, and it
was pulling ~15MB plus a Chromium download into the production image.

---

## 1 · Database

Already on Supabase. The only trap is the connection string:

- Use the **pooler** host, **Session mode**, port **5432**.
- The direct host `db.<ref>.supabase.co` is **IPv6-only**; an IPv4 address is a
  paid add-on. CI runners and most container hosts can't reach it.
- Username must include the project ref: `postgres.<project-ref>`.

---

## 2 · Deploy the API **[you]**

The Dockerfile is portable, so any container host works (Fly.io, Railway,
Render, Cloud Run). Set:

```
DATABASE_URL   = <supabase pooler URI, session mode>
CLIENT_URL     = <your web origin, for CORS>
PORT           = <injected by most platforms>
NODE_ENV       = production
```

Then:

- **Release/pre-deploy command:** `npx prisma migrate deploy`
  Not in the Dockerfile on purpose — two instances booting at once would race
  on the migration table.
- **Health probe:** `/health`. Do **not** point it at `/ready`; a transient
  Postgres blip would restart-loop the container.
- **Verify:** `curl https://<host>/ready` → `{"status":"ready","database":"up"}`

CORS already allows `capacitor://localhost` and `https://localhost`, so the
native app works without extra configuration. Set `CLIENT_URL` for the web
build's origin.

---

## 3 · Point the app at production

In `client/.env`:

```
VITE_PROD_API_URL=https://<your-api-host>
```

Then `npm run build:mobile`. This value is **inlined at build time** — changing
it means rebuilding, and an app built against the LAN IP will keep trying
`192.168.x.x` forever.

---

## 4 · Before shipping to the App Store

Two things added for local development must be reconsidered:

**Remove the ATS exception.** `client/ios/App/App/Info.plist` contains
`NSAppTransportSecurity → NSAllowsLocalNetworking`, which permits plain HTTP to
LAN addresses. It was needed to reach the dev server at `192.168.1.18:3001`.
Once `VITE_PROD_API_URL` is HTTPS, delete the key — it is not needed and
reviewers may ask about it.

**Rotate the Supabase keys.** The anon key ships inside the bundle, which is
fine by design. The *service-role* key must never appear in the client, and the
one in `server/.env` was pasted into a chat transcript during development —
rotate it under **Settings → API**.

---

## 5 · Turn on the scheduled refresh **[you]**

Add repository secret `DATABASE_URL` (same pooler URI) under
**Settings → Secrets and variables → Actions**. The workflow fails fast with a
clear message if it's missing rather than half-running.

Then trigger it manually once (**Actions → Refresh data → Run workflow**) to
confirm before trusting the 04:15 UTC schedule. Logs upload as an artifact even
on failure.

---

## Known gaps

- **The image is only checked in CI.** The smoke test boots it without a
  database, so it proves Prisma's engine loads and the CLI is present, not that
  migrations apply. Run `/ready` against a real database after the first deploy.
- **ESLint warnings are allowed.** Errors fail CI; six `no-explicit-any`
  warnings remain in the server and are reported, not enforced.
- **Two of five scrape sources are degraded** (`triennale` 0 links, `mudec`
  20 links → 1 event). Run `npm run db:audit` after deploying to see current
  coverage.
