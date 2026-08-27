import { PrismaClient } from '@prisma/client'

/**
 * Deletes telemetry older than the retention window.
 *
 * Two reasons, and both matter. Practically, the table only grows and a crash
 * loop in a shipped build can add a lot of rows quickly. Legally, data
 * minimisation means keeping diagnostics no longer than they are useful — and a
 * six-month-old error from a version nobody runs is not useful.
 *
 * 90 days by default: long enough to see a seasonal pattern, short enough that
 * the table never becomes a liability.
 *
 *   npm run telemetry:prune           # delete older than 90 days
 *   npm run telemetry:prune -- 30     # ...older than 30 days
 *   npm run telemetry:prune -- 90 --dry
 */

const prisma = new PrismaClient()

async function main() {
  const days = Number(process.argv[2]) || 90
  const dry  = process.argv.includes('--dry')
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const doomed = await prisma.telemetryEvent.count({ where: { createdAt: { lt: cutoff } } })
  const total  = await prisma.telemetryEvent.count()

  console.log(`Retention: ${days} days (cutoff ${cutoff.toISOString().slice(0, 10)})`)
  console.log(`Rows: ${total} total, ${doomed} older than the cutoff.`)

  if (!doomed) { console.log('Nothing to prune.'); return }

  if (dry) {
    console.log(`[dry] Would delete ${doomed} row(s).`)
    return
  }

  const { count } = await prisma.telemetryEvent.deleteMany({ where: { createdAt: { lt: cutoff } } })
  console.log(`Deleted ${count} row(s); ${total - count} remain.`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
