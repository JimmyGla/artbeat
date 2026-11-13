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
| `.github/workflows/deploy.yml` | After CI passes on `main`: migrate, trigger Render, wait for the new commit on `/health`, check `/ready`. Needs the setup in section 2. |
| `.github/workflows/uptime.yml` | Every 30 min: `/health` and `/ready`. Fails (and emails you) when either is down; also keeps the free Supabase project from pausing. Needs the `API_URL` variable. |
| `.github/workflows/refresh-data.yml` | Nightly scrape → repair → audit. Needs `DATABASE_URL` secret. |
| `server/Dockerfile` | Multi-stage, non-root, API-only. CI builds it and smoke-tests `/health`, `/ready` and the Prisma CLI on every PR. |
| `server/.dockerignore` | Excludes `scripts/`, `logs/`, `.env`. |
| `docker-compose.yml` | Local Postgres + PostGIS and the API image. Reads `server/.env`; migrate and seed from the host (see the file's header). |
| `GET /health` | Liveness. No DB access, safe for restart probes. Reports the deployed `commit`. |
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

## 2 · Deploy the API **[you, once]**

The API runs on Render (`artbeat-server`). Deploys go through GitHub Actions
(`.github/workflows/deploy.yml`), never through Render's own auto-deploy, so
that migrations always run first and only code that passed CI ships.

**On Render** (service → Settings / Environment):

1. **Auto-Deploy: Off.** Otherwise Render deploys on every push to `main`,
   before migrations and even when CI fails.
2. **Health Check Path:** `/health`. Not `/ready`: a database blip would
   restart-loop the service.
3. **Deploy Hook:** copy the URL. It's a secret; anyone with it can deploy.
4. **Environment:**
   ```
   DATABASE_URL              = <supabase pooler URI, session mode>
   CLIENT_URL                = <your web origin, for CORS>
   SUPABASE_URL              = https://<project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY = <service-role key>
   ADMIN_SECRET              = <openssl rand -hex 32>
   NODE_ENV                  = production
   ```
   `PORT` and `RENDER_GIT_COMMIT` are set by Render.

**On GitHub** (repo → Settings → Secrets and variables → Actions):

| Kind | Name | Value |
|---|---|---|
| Secret | `DATABASE_URL` | Same pooler URI. Also used by the nightly refresh. |
| Secret | `RENDER_DEPLOY_HOOK_URL` | The deploy hook URL |
| Variable | `API_URL` | `https://artbeat-server.onrender.com` |

Then run **Actions → Deploy API → Run workflow** once. It migrates, deploys
`main`, and fails loudly if `/health` doesn't show the new commit within 20
minutes or `/ready` can't reach the database.

From then on, every merge to `main` deploys itself once CI is green.

- **Rollback:** Render dashboard → Deploys → pick an earlier one → Rollback.
  Migrations aren't rolled back, which is why they must stay compatible with
  the previous release (CLAUDE.md).
- **Verify by hand:** `curl https://<host>/health` shows the live `commit`;
  `curl https://<host>/ready` → `{"status":"ready","database":"up"}`.

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

Uses the same `DATABASE_URL` repository secret as the deploy (section 2). The
workflow fails fast with a clear message if it's missing rather than
half-running.

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
