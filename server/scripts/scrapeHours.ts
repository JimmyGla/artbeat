import { chromium } from 'playwright'
import { PrismaClient } from '@prisma/client'
import { MILAN_VENUES } from './venues'
import { extractHoursFromJsonLd, pageMatchesVenue } from './hoursExtractor'
import { weeklySummary } from '../src/lib/openingHours'

/**
 * Reads opening hours from venues' own websites.
 *
 * Three rules, in priority order over any desire for coverage:
 *
 *   1. Hours are only ever read from the venue's published structured data.
 *      Nothing is inferred from prose, and nothing is defaulted.
 *   2. Nothing is stored unless the page demonstrably belongs to the venue,
 *      so a redirect or a parked domain cannot attach a stranger's hours.
 *   3. A venue that yields nothing keeps whatever it already had, and the run
 *      reports it. Silence is a valid outcome, and the UI shows no hours.
 *
 * Coverage is expected to be partial: most Italian museum sites publish hours
 * as prose, not markup. That is the honest ceiling of this approach, and the
 * summary at the end says exactly which venues are missing so they can be
 * filled in by hand.
 *
 *   npx tsx scripts/scrapeHours.ts          # all venues with a website
 *   npx tsx scripts/scrapeHours.ts --dry    # report only, write nothing
 */

const prisma = new PrismaClient()
const DRY = process.argv.includes('--dry')

const UA = 'ArtBeatBot/1.0 (+https://artbeat.app/bot; contact: hello@artbeat.app)'

interface Outcome {
  venue: string
  status: 'stored' | 'no-markup' | 'blocked' | 'identity-failed' | 'unreachable' | 'not-in-db'
  days?: number
  detail?: string
}

async function main() {
  const targets = MILAN_VENUES.filter((v) => v.website)
  console.log(
    `Opening hours: ${targets.length} of ${MILAN_VENUES.length} venues have a website on record.` +
    (DRY ? ' (dry run — nothing will be written)' : ''),
  )

  const browser = await chromium.launch()
  const context = await browser.newContext({ userAgent: UA })
  const outcomes: Outcome[] = []

  for (const entry of targets) {
    const venue = await prisma.venue.findFirst({
      where:  { name: entry.name },
      select: { id: true, name: true },
    })
    if (!venue) {
      outcomes.push({ venue: entry.name, status: 'not-in-db' })
      continue
    }

    const page = await context.newPage()
    try {
      const response = await page.goto(entry.website!, { waitUntil: 'domcontentloaded', timeout: 25_000 })

      // Distinguish "the site refused us" from "this is the wrong venue".
      // Both used to surface as identity-failed, which read as a bad URL when
      // the real cause was a 403 against our user agent — a different problem
      // with a different fix.
      const status = response?.status() ?? 0
      if (status >= 400) {
        outcomes.push({ venue: entry.name, status: 'blocked', detail: `HTTP ${status}` })
        continue
      }

      const blocks = await page.$$eval(
        'script[type="application/ld+json"]',
        (nodes) => nodes.map((n) => n.textContent ?? ''),
      )
      const pageText = await page.evaluate(() => document.body?.innerText ?? '')

      // Identity before data: confirm the page is this venue's before trusting
      // anything on it.
      if (!pageMatchesVenue(entry.name, `${pageText}\n${await page.title()}`)) {
        outcomes.push({
          venue: entry.name,
          status: 'identity-failed',
          detail: page.url(),
        })
        continue
      }

      const ranges = extractHoursFromJsonLd(blocks)
      if (!ranges.length) {
        outcomes.push({ venue: entry.name, status: 'no-markup', detail: `${blocks.length} ld+json block(s)` })
        continue
      }

      if (!DRY) {
        // Replace wholesale inside a transaction: a partial write would leave a
        // venue advertising a mix of old and new hours, which is worse than
        // either alone.
        await prisma.$transaction([
          prisma.openingHours.deleteMany({ where: { venueId: venue.id } }),
          prisma.openingHours.createMany({
            data: ranges.map((r) => ({ venueId: venue.id, ...r })),
          }),
          prisma.venue.update({
            where: { id: venue.id },
            data:  { hoursSourceUrl: entry.website, hoursCheckedAt: new Date() },
          }),
        ])
      }

      const days = new Set(ranges.map((r) => r.weekday)).size
      outcomes.push({ venue: entry.name, status: 'stored', days })
    } catch (err) {
      outcomes.push({
        venue: entry.name,
        status: 'unreachable',
        detail: err instanceof Error ? err.message.split('\n')[0].slice(0, 90) : String(err),
      })
    } finally {
      await page.close()
    }
  }

  await browser.close()

  // ── Report ────────────────────────────────────────────────────────────────
  const by = (s: Outcome['status']) => outcomes.filter((o) => o.status === s)

  console.log('\n─── Result ────────────────────────────────────────────────')
  for (const o of by('stored')) {
    console.log(`  ✓ ${o.venue} — hours on ${o.days} day(s)`)
  }
  for (const o of [...by('no-markup'), ...by('blocked'), ...by('identity-failed'), ...by('unreachable'), ...by('not-in-db')]) {
    console.log(`  · ${o.venue} — ${o.status}${o.detail ? ` (${o.detail})` : ''}`)
  }

  console.log(
    `\n  ${by('stored').length} with hours, ${outcomes.length - by('stored').length} without.` +
    `\n  Venues without hours display none — they are never guessed.`,
  )

  const noSite = MILAN_VENUES.filter((v) => !v.website).map((v) => v.name)
  if (noSite.length) {
    console.log(`\n  No website on record (${noSite.length}): ${noSite.join(', ')}`)
  }

  // Show one venue's parsed week, as a sanity check that the shape is sane
  // rather than merely non-empty.
  const sample = by('stored')[0]
  if (sample) {
    const v = await prisma.venue.findFirst({ where: { name: sample.venue }, select: { id: true } })
    const rows = await prisma.openingHours.findMany({ where: { venueId: v!.id } })
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    console.log(`\n  Sample — ${sample.venue}:`)
    for (const d of weeklySummary(rows)) {
      console.log(`    ${DAYS[d.weekday]}  ${d.ranges.length ? d.ranges.join(', ') : 'closed'}`)
    }
  }
}

main()
  .catch((err) => {
    console.error('[scrapeHours] fatal —', err)
    process.exit(1) // must not exit 0, or a cron reports success forever
  })
  .finally(() => prisma.$disconnect())
