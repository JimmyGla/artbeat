import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { prisma } from './lib/prisma'
import router from './router'

// ─── App ─────────────────────────────────────────────────────────────────────

const app  = express()
const PORT = Number(process.env.PORT) || 3001

// ─── Middleware ───────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set([
  process.env.CLIENT_URL ?? 'http://localhost:5173',
  'capacitor://localhost', // iOS native
  'http://localhost',      // Android native
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

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' })
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

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🎵 ArtBeat server running on http://localhost:${PORT}`)
  console.log(`   Health  → http://localhost:${PORT}/health`)
  console.log(`   API     → http://localhost:${PORT}/api`)
})

// Graceful shutdown
const shutdown = async () => {
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT',  shutdown)
process.on('SIGTERM', shutdown)