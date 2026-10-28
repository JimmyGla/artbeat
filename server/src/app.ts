import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { prisma } from './lib/prisma'
import router from './router'

// ─── App ─────────────────────────────────────────────────────────────────────
// Built here, started in index.ts — so tests can use the app without a port.

const app = express()

// ─── Middleware ───────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set([
  process.env.CLIENT_URL ?? 'http://localhost:5173',
  'capacitor://localhost', // iOS native
  'http://localhost',      // Android native (http scheme)
  'https://localhost',     // Android native (https scheme via androidScheme)
])

app.use(
  cors({
    origin: (origin, cb) => {
      // No origin = curl / server-to-server / some native clients
      if (!origin || ALLOWED_ORIGINS.has(origin)) cb(null, true)
      else cb(new Error(`CORS: ${origin} not allowed`))
    },
    credentials:    true,
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * Liveness — is the process up?  Must not touch the database: a hosting
 * platform restarts containers that fail this, and killing the API because
 * Postgres blipped turns a brief outage into a restart loop.
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

/**
 * Readiness — can this instance actually serve traffic?  Checks the database,
 * so it belongs behind a load balancer's readiness probe (and is what to curl
 * after a deploy to confirm DATABASE_URL is right).
 */
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ready', database: 'up' })
  } catch (err) {
    console.error('Readiness check failed:', err)
    res.status(503).json({ status: 'not ready', database: 'down' })
  }
})

app.use('/api', router)

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', status: 404 })
})

// ─── Global error handler ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error', status: 500 })
})

export default app
