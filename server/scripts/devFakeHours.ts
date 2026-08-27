import { PrismaClient } from '@prisma/client'

/**
 * Dev-only: puts obviously-synthetic opening hours on one venue so the venue
 * page's hours UI can be exercised, then removes them again.
 *
 * These hours are NOT real and must never be left in place — that is the whole
 * reason this is a separate throwaway script rather than a seed file. Real
 * hours belong in data/venue-hours.json with a source URL.
 *
 *   npx tsx scripts/devFakeHours.ts <venue name>
 *   npx tsx scripts/devFakeHours.ts <venue name> clear
 */

const prisma = new PrismaClient()

async function main() {
  const name  = process.argv[2]
  const clear = process.argv[3] === 'clear'
  if (!name) {
    console.error('Usage: devFakeHours.ts <venue name> [clear]')
    process.exit(1)
  }

  const venue = await prisma.venue.findFirst({ where: { name }, select: { id: true, name: true } })
  if (!venue) {
    console.error(`No venue named "${name}"`)
    process.exit(1)
  }

  await prisma.openingHours.deleteMany({ where: { venueId: venue.id } })
  await prisma.venueClosure.deleteMany({ where: { venueId: venue.id } })

  if (clear) {
    await prisma.venue.update({
      where: { id: venue.id },
      data:  { hoursSourceUrl: null, hoursCheckedAt: null },
    })
    console.log(`Cleared all hours for ${venue.name}.`)
    return
  }

  // Tue–Sun 10:00–19:30 with a Saturday late night, closed Monday: the shape of
  // a real Italian museum week, so the UI is exercised on realistic data.
  const rows = [
    ...[2, 3, 4, 5, 0].map((weekday) => ({ venueId: venue.id, weekday, opensAt: 600, closesAt: 1170 })),
    { venueId: venue.id, weekday: 6, opensAt: 600, closesAt: 1350 },
  ]

  await prisma.openingHours.createMany({ data: rows })
  await prisma.venue.update({
    where: { id: venue.id },
    data:  { hoursSourceUrl: 'https://example.invalid/NOT-REAL', hoursCheckedAt: new Date() },
  })

  console.log(
    `Applied SYNTHETIC hours to ${venue.name} (${rows.length} rows).\n` +
    `Source is deliberately example.invalid so this cannot be mistaken for real data.\n` +
    `Remove with: npx tsx scripts/devFakeHours.ts "${venue.name}" clear`,
  )
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
