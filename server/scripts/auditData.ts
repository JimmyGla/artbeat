/**
 * Data-quality audit.  Run with `npm run db:audit`.
 *
 * Read-only.  Phase 1 is about trusting the data, and you cannot maintain a
 * quality bar you do not measure — this prints the numbers that matter and
 * exits non-zero when any of them crosses a threshold, so it can gate CI or a
 * scheduled scrape.
 */

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const prisma = new PrismaClient()

/** Fail the run when a metric is worse than this. */
const THRESHOLDS = {
  maxUnmappablePct:  25,   // events with no confirmed venue
  maxNoEndDatePct:   25,   // events with no end date (ambiguous "is it still on?")
  maxEchoedDescPct:  25,   // description that merely repeats the title
  /**
   * Untagged medium. Deliberately a smoke test, not a quality bar: coverage is
   * capped by how much prose the sources give us, and most descriptions are
   * empty because two of five scrape sources are degraded. At 90% this catches
   * "tagging stopped working entirely" — the failure worth waking up for —
   * without crying wolf every run. Tighten it as description coverage improves.
   */
  maxNoArtFormPct:   90,
}

function pct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 1000) / 10
}

function bar(p: number): string {
  const filled = Math.round(p / 5)
  return '█'.repeat(filled) + '·'.repeat(20 - filled)
}

async function main() {
  console.log('📊 ArtBeat data audit\n')

  const cities = await prisma.city.findMany({ orderBy: { name: 'asc' } })
  const failures: string[] = []

  for (const city of cities) {
    const events = await prisma.exhibition.findMany({
      where:  { venue: { cityId: city.id } },
      select: {
        title: true, description: true, startsOn: true, endsOn: true,
        run: true, format: true, admission: true, priceCents: true,
        imageUrl: true, ticketUrl: true, sourceName: true,
        venue:    { select: { name: true, isPlaceholder: true, kind: true } },
        artForms: { select: { artFormId: true } },
      },
    })

    const venueCount = await prisma.venue.count({ where: { cityId: city.id, isPlaceholder: false } })

    console.log(`── ${city.name} ${'─'.repeat(Math.max(0, 38 - city.name.length))}`)
    if (events.length === 0) {
      console.log('   no events\n')
      continue
    }

    const now         = new Date()
    const unmappable  = events.filter((e) => e.venue.isPlaceholder)
    // Only TEMPORARY runs can be missing an end date ambiguously; a permanent
    // run has none by definition, so counting it here would be noise.
    const noEnd       = events.filter((e) => e.run === 'TEMPORARY' && !e.endsOn)
    // A description that just repeats the title carries no information.
    const echoed      = events.filter((e) => {
      const d = e.description.trim().toLowerCase()
      const t = e.title.trim().toLowerCase()
      return d === t || d.startsWith(t.slice(0, Math.min(40, t.length)))
    })
    const noImage     = events.filter((e) => !e.imageUrl)
    const noTicketUrl = events.filter((e) => !e.ticketUrl)
    const ended       = events.filter((e) => e.endsOn && e.endsOn < now)
    const ambiguous   = events.filter((e) => e.run === 'TEMPORARY' && !e.endsOn && e.startsOn && e.startsOn < now)
    const noArtForm   = events.filter((e) => e.artForms.length === 0)
    const unknownCost = events.filter((e) => e.admission === 'UNKNOWN')

    const rows: [string, number, number | null][] = [
      ['events',                events.length,      null],
      ['real venues',           venueCount,         null],
      ['no confirmed venue',    unmappable.length,  THRESHOLDS.maxUnmappablePct],
      ['no end date',           noEnd.length,       THRESHOLDS.maxNoEndDatePct],
      ['  └ started already',   ambiguous.length,   null],
      ['description = title',   echoed.length,      THRESHOLDS.maxEchoedDescPct],
      ['no art form',           noArtForm.length,   THRESHOLDS.maxNoArtFormPct],
      ['admission unknown',     unknownCost.length, null],
      ['no image',              noImage.length,     null],
      ['no ticket url',         noTicketUrl.length, null],
      ['already ended',         ended.length,       null],
    ]

    for (const [label, count, threshold] of rows) {
      const p = pct(count, events.length)
      const isCount = threshold === null && (label === 'events' || label === 'real venues')
      const shown   = isCount ? `${count}` : `${String(count).padStart(3)}  ${bar(p)} ${p}%`
      const flag    = threshold !== null && p > threshold ? '  ✗ OVER THRESHOLD' : ''
      console.log(`   ${label.padEnd(20)} ${shown}${flag}`)
      if (threshold !== null && p > threshold) {
        failures.push(`${city.name}: ${label} at ${p}% (max ${threshold}%)`)
      }
    }

    // Spreads worth eyeballing: all-OTHER venues means curation is not working,
    // and an all-EXHIBITION format spread means the format split is unused.
    const spread = (get: (e: typeof events[number]) => string) => {
      const m = new Map<string, number>()
      for (const e of events) m.set(get(e), (m.get(get(e)) ?? 0) + 1)
      return [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join('  ')
    }
    console.log(`   venue kinds          ${spread((e) => e.venue.kind)}`)
    console.log(`   formats              ${spread((e) => e.format)}`)
    console.log(`   runs                 ${spread((e) => e.run)}`)
    console.log(`   sources              ${spread((e) => e.sourceName ?? '(none)')}`)
    console.log()
  }

  if (failures.length) {
    console.log('─────────────────────────────────────────')
    console.log('✗ Audit failed:')
    failures.forEach((f) => console.log(`    ${f}`))
    console.log('─────────────────────────────────────────')
    process.exitCode = 1
  } else {
    console.log('✓ All metrics within threshold')
  }
}

main()
  .catch((err) => { console.error('Fatal error:', err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
