import 'dotenv/config'
import { prisma } from './lib/prisma'
import app from './app'

const PORT = Number(process.env.PORT) || 3001

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