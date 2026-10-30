# ArtBeat — Deployment Guide

> **Older long-form guide.** [DEPLOY.md](../DEPLOY.md) is the current short path and wins wherever the two disagree. This file is kept for the platform signup and OAuth walkthroughs.

This guide walks through deploying ArtBeat from scratch on free-tier cloud services.

**Stack overview**

| Layer    | Service                          | Notes                        |
|----------|----------------------------------|------------------------------|
| Database | Railway PostgreSQL or Supabase   | PostGIS required             |
| Backend  | Railway or Render (free tier)    | Node 20, Express             |
| Frontend | Vercel (free tier)               | Vite + React                 |
| Auth     | Supabase                         | Email + Google OAuth         |

---

## Prerequisites

- A [Supabase](https://supabase.com) project (handles auth for both email and Google OAuth).
- A GitHub repository containing the `artbeat` monorepo.
- Accounts on [Railway](https://railway.app) **or** [Render](https://render.com) for the backend.
- An account on [Vercel](https://vercel.com) for the frontend.

---

## 1 · Deploy the database

You have two options: **Railway** (simpler, one platform) or **Supabase's own Postgres** (saves a separate service).

### Option A — Railway PostgreSQL + PostGIS

1. Log in to [railway.app](https://railway.app) and create a new project.
2. Click **New Service → Database → PostgreSQL**. Railway provisions the database automatically.
3. Enable PostGIS:
   - Open the database service → **Query** tab.
   - Run:
     ```sql
     CREATE EXTENSION IF NOT EXISTS postgis;
     CREATE EXTENSION IF NOT EXISTS postgis_topology;
     ```
4. Copy the **DATABASE_URL** from the database service's **Variables** tab. It looks like:
   ```
   postgresql://postgres:PASSWORD@HOST:PORT/railway
   ```
5. Use this value as `DATABASE_URL` in your backend service (see Section 2).

### Option B — Supabase Postgres (built-in)

Supabase already provisions a PostgreSQL instance with PostGIS enabled for every project.

1. In your Supabase project, go to **Settings → Database** and pick
   **Connection pooler** — *not* the direct connection shown by default.

   The direct host (`db.<ref>.supabase.co`) has **no IPv4 address**; it resolves
   to IPv6 only, and an IPv4 add-on is a paid extra. Most laptops, CI runners
   and container hosts have no IPv6 route, so the direct URI fails with
   "Can't reach database server" no matter how correct the password is. Use the
   pooler host, which is IPv4-reachable.

2. Prefer **Session mode** (port **5432** on the *pooler* host):
   ```
   postgresql://postgres.<project-ref>:[PASSWORD]@aws-1-<region>.pooler.supabase.com:5432/postgres
   ```
   Note the username carries the project ref (`postgres.<project-ref>`) — the
   pooler needs it to route to your project, and a plain `postgres` username
   fails to authenticate.

3. Transaction mode (port 6543) also works but does not support prepared
   statements, so Prisma needs `?pgbouncer=true` appended and **cannot run
   migrations through it**. Session mode avoids both problems; use it unless
   you have a specific reason not to.

4. If the password contains reserved URL characters, percent-encode them
   (`*` → `%2A`, `@` → `%40`).

> **Note:** PostGIS is pre-installed on all Supabase Postgres instances.

---

## 2 · Deploy the backend

### Option A — Railway (recommended)

1. In the same Railway project, click **New Service → GitHub Repo**.
2. Select your repository. Set the **Root Directory** to `server`.
3. Railway auto-detects Node. Confirm it runs:
   - **Build command:** `npm ci && npm run build && npx prisma generate`
   - **Start command:** `npm run start`
4. Go to **Variables** and add all values from `server/.env.example`:

   | Variable                  | Value                                          |
   |---------------------------|------------------------------------------------|
   | `DATABASE_URL`            | From Step 1                                    |
   | `PORT`                    | `3001` (Railway will override with its own)    |
   | `CLIENT_URL`              | Your Vercel URL (set after Step 3)             |
   | `SUPABASE_URL`            | `https://YOUR_REF.supabase.co`                 |
   | `SUPABASE_SERVICE_ROLE_KEY` | From Supabase → Settings → API               |
   | `ADMIN_SECRET`            | `openssl rand -hex 32`                         |

5. Click **Deploy**. Railway builds the Docker image and starts the server.
6. Copy the generated **Public URL** (e.g. `https://artbeat-api.up.railway.app`).

### Option B — Render (free tier)

1. Go to [render.com](https://render.com) → **New Web Service**.
2. Connect your GitHub repo, set the root directory to `server`.
3. Configure:
   - **Runtime:** Node
   - **Build command:** `npm ci && npm run build && npx prisma generate`
   - **Start command:** `node dist/index.js`
   - **Instance type:** Free
4. Add the same environment variables as the Railway table above under **Environment**.
5. Click **Create Web Service**. Note the public URL.

> **Free tier warning (Render):** Free instances spin down after 15 minutes of inactivity. The first request after a cold start may take ~30 seconds. Upgrade to the Starter plan ($7/month) to avoid this.

---

## 3 · Deploy the frontend

1. Push your repo to GitHub if you haven't already.
2. Go to [vercel.com](https://vercel.com) → **Add New Project → Import Git Repository**.
3. Select your repo. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `client`
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. Under **Environment Variables**, add:

   | Variable             | Value                                                    |
   |----------------------|----------------------------------------------------------|
   | `VITE_API_URL`       | Your Railway/Render backend URL (no trailing slash)      |
   | `VITE_SUPABASE_URL`  | `https://YOUR_REF.supabase.co`                           |
   | `VITE_SUPABASE_ANON_KEY` | From Supabase → Settings → API (anon key)           |

5. Click **Deploy**. Vercel builds and publishes the frontend.
6. Copy the Vercel deployment URL (e.g. `https://artbeat.vercel.app`).
7. Go back to your **backend service** on Railway/Render and update `CLIENT_URL` to this Vercel URL. Redeploy the backend.

---

## 4 · Run the seed on the production database

After deploying the backend for the first time, the database schema is empty. To populate it with the Milan seed data:

### Via Railway

```bash
# Ensure DATABASE_URL is set locally to the Railway connection string
export DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"

cd server
npm run prisma:seed
```

### Via Render

Render doesn't have a one-off job runner on the free tier. Use the local seed method above, pointing `DATABASE_URL` at the Render/Supabase database.

### Manually via Prisma Studio

```bash
cd server
DATABASE_URL="..." npx prisma studio
```

---

## 5 · Set up Google OAuth redirect URLs

Google OAuth is handled entirely through Supabase. You do **not** need to configure `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` directly in ArtBeat — Supabase stores those.

### In Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services → Credentials**.
2. Open (or create) your OAuth 2.0 Client ID.
3. Under **Authorised redirect URIs**, add:
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```
4. Under **Authorised JavaScript origins**, add your Vercel URL:
   ```
   https://artbeat.vercel.app
   ```
5. Save.

### In Supabase Dashboard

1. Go to **Authentication → Providers → Google**.
2. Enable Google provider.
3. Paste in the **Client ID** and **Client Secret** from Google Cloud Console.
4. Under **Redirect URLs**, add your Vercel deployment URL:
   ```
   https://artbeat.vercel.app/auth/callback
   ```
   (This is the route handled by `AuthCallbackPage.tsx`.)
5. Save.

### Testing OAuth locally

Add `http://localhost:5173/auth/callback` to Supabase's allowed redirect URLs during development.

---

## 6 · Running locally with Docker Compose

```bash
# 1. Copy and configure env files (compose reads server/.env)
cp server/.env.example server/.env
# Edit server/.env — fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

# 2. Start the stack (Postgres + server)
docker compose up --build -d

# 3. Migrate and seed from the host — the image runs the API only
cd server
export DATABASE_URL="postgresql://artbeat:artbeat@localhost:5432/artbeat?schema=public"
npx prisma migrate deploy
npm run prisma:seed
cd ..

# 4. Run the client separately (Vite HMR doesn't work in Docker for dev)
cp client/.env.example client/.env
# VITE_API_URL=http://localhost:3001
cd client && npm install && npm run dev
```

The server will be available at `http://localhost:3001` and the client at `http://localhost:5173`.

---

## 7 · Environment variable reference

### server/.env

| Variable                  | Required | Description                                          |
|---------------------------|----------|------------------------------------------------------|
| `DATABASE_URL`            | ✓        | PostgreSQL connection string                         |
| `PORT`                    |          | HTTP port (default: 3001; injected by Railway/Render)|
| `CLIENT_URL`              | ✓        | Frontend origin for CORS                             |
| `SUPABASE_URL`            | ✓        | Supabase project URL                                 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓      | Supabase service-role secret key (server only)       |
| `ADMIN_SECRET`            | ✓        | Shared secret for `/api/admin/*` endpoints           |

### client/.env

| Variable               | Required | Description                                     |
|------------------------|----------|-------------------------------------------------|
| `VITE_API_URL`         | ✓        | Backend API base URL                            |
| `VITE_SUPABASE_URL`    | ✓        | Supabase project URL                            |
| `VITE_SUPABASE_ANON_KEY` | ✓      | Supabase anon (public) key                      |

---

## 8 · CI/CD

See [DEPLOY.md](../DEPLOY.md#what-is-already-prepared) and `.github/workflows/ci.yml`. CI only checks; nothing deploys from it yet.
