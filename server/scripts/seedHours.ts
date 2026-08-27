import { readFileSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { parseClock, weeklySummary, type HoursRange } from '../src/lib/openingHours'
import { parseDayOfWeek } from './hoursExtractor'

/**
 * Loads hand-entered opening hours from data/venue-hours.json.
 *
 * Automated extraction returns nothing for Milan (see scrapeHours), so this is
 * the path by which hours actually reach the app. Every entry is validated
 * hard: a typo here becomes a confident wrong answer on the venue page, which
 * is the one failure this feature must not have. Anything that does not parse
 * aborts the whole run rather than being skipped, so a broken entry cannot
 * quietly leave a venue half-updated.
 *
 *   npx tsx scripts/seedHours.ts
 *   npx tsx scripts/seedHours.ts --dry
 */

const prisma = new PrismaClient()
const DRY = process.argv.includes('--dry')

const rangeSchema = z.object({
  days:   z.array(z.union([z.string(), z.number()])).min(1),
  opens:  z.string(),
  closes: z.string(),
})

const venueSchema = z.object({
  name:   z.string().min(1),
  source: z.string().url('source must be the URL the hours were read from'),
  hours:  z.array(rangeSchema).min(1),
  closed: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
})

const fileSchema = z.object({ venues: z.array(venueSchema) })

function toRanges(entry: z.infer<typeof venueSchema>): HoursRange[] {
  const out: HoursRange[] = []

  for (const [i, r] of entry.hours.entries()) {
    const opensAt  = parseClock(r.opens)
    const closesAt = parseClock(r.closes)
    if (opensAt === null)  throw new Error(`${entry.name}: hours[${i}].opens "${r.opens}" is not HH:MM`)
    if (closesAt === null) throw new Error(`${entry.name}: hours[${i}].closes "${r.closes}" is not HH:MM`)
    if (closesAt <= opensAt) {
      throw new Error(`${entry.name}: hours[${i}] closes at or before it opens (${r.opens}–${r.closes})`)
    }

    for (const day of r.days) {
      const weekday = typeof day === 'number' ? day : parseDayOfWeek(day)
      if (weekday === null || weekday < 0 || weekday > 6) {
        throw new Error(`${entry.name}: hours[${i}] has unrecognised day "${day}"`)
      }
      out.push({ weekday, opensAt, closesAt })
    }
  }

  return out
}

async function main() {
  const path = join(__dirname, '..', 'data', 'venue-hours.json')
  const parsed = fileSchema.safeParse(JSON.parse(readFileSync(path, 'utf-8')))
  if (!parsed.success) {
    console.error('venue-hours.json is malformed:')
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  const entries = parsed.data.venues
  if (!entries.length) {
    console.log(
      'No hand-entered hours yet — data/venue-hours.json is empty.\n' +
      'Venues without hours show none in the app, which is intended: hours are\n' +
      'never guessed. Add entries following the _example key in that file.',
    )
    return
  }

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  for (const entry of entries) {
    const venue = await prisma.venue.findFirst({ where: { name: entry.name }, select: { id: true } })
    if (!venue) {
      // Fail loudly: a name typo would otherwise silently seed nothing, and the
      // venue would look like it simply has no hours.
      throw new Error(`No venue named "${entry.name}" — check it matches scripts/venues.ts exactly`)
    }

    const ranges = toRanges(entry)

    if (!DRY) {
      await prisma.$transaction([
        prisma.openingHours.deleteMany({ where: { venueId: venue.id } }),
        prisma.openingHours.createMany({ data: ranges.map((r) => ({ venueId: venue.id, ...r })) }),
        prisma.venueClosure.deleteMany({ where: { venueId: venue.id } }),
        prisma.venueClosure.createMany({
          data: (entry.closed ?? []).map((d) => ({ venueId: venue.id, date: new Date(`${d}T00:00:00Z`) })),
        }),
        prisma.venue.update({
          where: { id: venue.id },
          data:  { hoursSourceUrl: entry.source, hoursCheckedAt: new Date() },
        }),
      ])
    }

    console.log(`${DRY ? '[dry] ' : ''}${entry.name}`)
    for (const d of weeklySummary(ranges)) {
      console.log(`    ${DAYS[d.weekday]}  ${d.ranges.length ? d.ranges.join(', ') : 'closed'}`)
    }
    if (entry.closed?.length) console.log(`    closed on: ${entry.closed.join(', ')}`)
  }

  console.log(`\n${DRY ? 'Would seed' : 'Seeded'} ${entries.length} venue(s).`)
}

main()
  .catch((err) => {
    console.error('[seedHours]', err instanceof Error ? err.message : err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
