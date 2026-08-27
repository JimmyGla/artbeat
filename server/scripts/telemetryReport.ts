import { PrismaClient } from '@prisma/client'

/**
 * Reads the telemetry table back.
 *
 * Collecting diagnostics nobody ever looks at is the worst of both worlds: it
 * carries the privacy cost of collection and returns none of the benefit. This
 * is the thing that makes the table worth having — top errors first, because
 * that is the only part that demands action.
 *
 *   npm run telemetry:report          # last 7 days
 *   npm run telemetry:report -- 30    # last 30 days
 */

const prisma = new PrismaClient()

async function main() {
  const days = Number(process.argv[2]) || 7
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [errors, events, installs] = await Promise.all([
    prisma.telemetryEvent.groupBy({
      by: ['name'],
      where: { kind: 'error', createdAt: { gte: since } },
      _count: { name: true },
      orderBy: { _count: { name: 'desc' } },
      take: 15,
    }),
    prisma.telemetryEvent.groupBy({
      by: ['name'],
      where: { kind: 'event', createdAt: { gte: since } },
      _count: { name: true },
      orderBy: { _count: { name: 'desc' } },
      take: 20,
    }),
    prisma.telemetryEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { installId: true, platform: true },
      distinct: ['installId'],
    }),
  ])

  console.log(`\n── Last ${days} day(s) ──────────────────────────────────────`)

  const byPlatform = installs.reduce<Record<string, number>>((acc, i) => {
    acc[i.platform] = (acc[i.platform] ?? 0) + 1
    return acc
  }, {})
  console.log(
    `\nDistinct installs: ${installs.length}` +
    (installs.length ? `  (${Object.entries(byPlatform).map(([p, n]) => `${p} ${n}`).join(', ')})` : ''),
  )

  console.log('\nErrors')
  if (!errors.length) {
    console.log('  none 🎉')
  } else {
    for (const e of errors) console.log(`  ${String(e._count.name).padStart(5)}  ${e.name}`)

    // The most recent example of the top error, because a count alone is not
    // actionable — you need one concrete instance to start from.
    const worst = errors[0].name
    const sample = await prisma.telemetryEvent.findFirst({
      where: { kind: 'error', name: worst, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    })
    if (sample) {
      console.log(`\n  Most recent "${worst}":`)
      console.log(`    when    : ${sample.occurredAt.toISOString()}`)
      console.log(`    version : ${sample.appVersion} on ${sample.platform}`)
      console.log(`    message : ${sample.message ?? '—'}`)
      console.log(`    props   : ${JSON.stringify(sample.props)}`)
      if (sample.stack) {
        for (const line of sample.stack.split('\n').slice(0, 6)) {
          console.log(`      ${line.trim()}`)
        }
      }
    }
  }

  console.log('\nEvents')
  if (!events.length) console.log('  none')
  else for (const e of events) console.log(`  ${String(e._count.name).padStart(5)}  ${e.name}`)

  const total = await prisma.telemetryEvent.count()
  console.log(`\nTable holds ${total} row(s) in total. Prune with npm run telemetry:prune.\n`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
