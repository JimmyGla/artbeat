/**
 * Post-scrape reconciliation: takedowns, duplicates, openings.
 *
 * Three jobs that all need the whole picture, so they run after a scrape rather
 * than inside it:
 *
 *   1. Takedown detection, gated on source health. An exhibition missing from a
 *      *working* source was probably pulled. One missing because the source
 *      returned zero links proves nothing — that is a scraper failure wearing
 *      the same shape. Only the first counts, and only after several runs.
 *
 *   2. Cross-source duplicates. Identity is `sourceUrl`, so the same show
 *      listed on arte.it *and* the museum's own site becomes two rows. Merge on
 *      title + venue + overlapping dates, keeping the venue's own page as
 *      canonical because its data is better than an aggregator's.
 *
 *   3. Opening → exhibition links. `parentId` exists and nothing ever set it,
 *      so a vernissage floats free of the show it opens.
 *
 * Run with `npm run db:reconcile`. `--dry` previews. Reads the health report
 * the scraper writes to logs/last-run-sources.json.
 */

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { normalizeForMatch } from './venues'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const prisma = new PrismaClient()
const DRY = process.argv.includes('--dry')

/** Misses required before we believe a show is really gone. */
const MISSES_BEFORE_WITHDRAWN = 3

const HEALTH_FILE = path.resolve(__dirname, '../logs/last-run-sources.json')

interface SourceHealth {
  label: string
  linkCount: number
  events: number
  /** The listing hit the per-source cap, so we saw a page, not everything. */
  capped?: boolean
  ranAt: string
}

function readHealth(): SourceHealth[] | null {
  try {
    return JSON.parse(fs.readFileSync(HEALTH_FILE, 'utf8')) as SourceHealth[]
  } catch {
    return null
  }
}

// ─── 1. Takedowns ─────────────────────────────────────────────────────────────

async function detectTakedowns(health: SourceHealth[]) {
  // Absence is only evidence when the source both worked AND showed us its
  // whole programme. A capped listing is a page: arte.it rotates 20 at a time,
  // so a show sliding off page one would otherwise look withdrawn within three
  // runs even though it is still open.
  const usable = (h: SourceHealth) => h.linkCount > 0 && h.events > 0 && !h.capped
  const healthy = health.filter(usable).map((h) => h.label)
  const skipped = health.filter((h) => !usable(h))
    .map((h) => `${h.label}${h.capped ? ' (listing truncated)' : ' (no events)'}`)

  console.log(`\n── Takedowns`)
  console.log(`   healthy sources : ${healthy.join(', ') || '(none)'}`)
  if (skipped.length) {
    console.log(`   ignored — absence proves nothing: ${skipped.join(', ')}`)
  }
  if (!healthy.length) {
    console.log('   no healthy source this run; skipping entirely')
    return { flagged: 0, withdrawn: 0, recovered: 0 }
  }

  const ranAt = new Date(health[0]?.ranAt ?? Date.now())

  // Rows from a healthy source that this run did not touch.
  const stale = await prisma.exhibition.findMany({
    where: {
      sourceName: { in: healthy },
      withdrawnAt: null,
      run: 'TEMPORARY',                       // curated permanents never expire
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: ranAt } }],
    },
    select: { id: true, title: true, missedRuns: true, sourceName: true },
  })

  let flagged = 0, withdrawn = 0
  for (const e of stale) {
    const misses = e.missedRuns + 1
    const gone = misses >= MISSES_BEFORE_WITHDRAWN

    if (!DRY) {
      await prisma.exhibition.update({
        where: { id: e.id },
        data: { missedRuns: misses, ...(gone ? { withdrawnAt: new Date() } : {}) },
      })
    }
    if (gone) { withdrawn++; console.log(`   ✗ withdrawn (${misses} misses) ${e.title.slice(0, 52)}`) }
    else      { flagged++ }
  }

  // Anything seen again resets — a source hiccup should not accumulate toward
  // a takedown.
  const recovered = DRY ? 0 : (await prisma.exhibition.updateMany({
    where: { sourceName: { in: healthy }, lastSeenAt: { gte: ranAt }, missedRuns: { gt: 0 } },
    data:  { missedRuns: 0 },
  })).count

  console.log(`   flagged ${flagged}, withdrawn ${withdrawn}, counters reset ${recovered}`)
  return { flagged, withdrawn, recovered }
}

// ─── 2. Cross-source duplicates ───────────────────────────────────────────────

/** Aggregators append their own name and boilerplate; strip it before comparing. */
function titleKey(title: string): string {
  return normalizeForMatch(title)
    .replace(/\s*-\s*(mostra|mostre|exhibition)\s*-\s*/g, ' ')
    .replace(/\s*-\s*milano\s*-\s*/g, ' ')
    .replace(/\s*-\s*(arte\.it|milanotoday)\s*$/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 6)          // first six words carry the identity
    .join(' ')
}

/**
 * Do two runs coincide?
 *
 * Permanent runs have no dates by definition, so a date test can never group
 * them — which is how a typo fix in the seed file produced two copies of the
 * Castello Sforzesco collection that nothing could merge. Two permanent runs at
 * the same venue with the same title ARE the same thing; date overlap only
 * makes sense between temporary ones.
 */
const overlaps = (
  a: { run: string; startsOn: Date | null; endsOn: Date | null },
  b: { run: string; startsOn: Date | null; endsOn: Date | null },
) => {
  if (a.run === 'PERMANENT' && b.run === 'PERMANENT') return true
  if (a.run !== b.run) return false
  if (!a.startsOn || !b.startsOn) return false
  const aEnd = a.endsOn ?? a.startsOn
  const bEnd = b.endsOn ?? b.startsOn
  return a.startsOn <= bEnd && b.startsOn <= aEnd
}

/**
 * Similarity of two normalised titles, 0–1, by edit distance.
 *
 * Key-based grouping cannot catch a typo: fixing "Castelo" → "Castello" in the
 * seed file produced two rows whose keys differed by one character and so were
 * never compared. Edit distance handles that, while still keeping genuinely
 * different shows apart — they differ by far more than a character or two.
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (!a.length || !b.length) return 0

  // Iterative Levenshtein with a single row; titles are short.
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = curr
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length)
}

/** Above this, two titles at the same venue are the same show. */
const TITLE_SIMILARITY = 0.9

async function mergeDuplicates() {
  console.log(`\n── Duplicates`)

  const rows = await prisma.exhibition.findMany({
    where: { withdrawnAt: null },
    select: {
      id: true, title: true, venueId: true, run: true, startsOn: true, endsOn: true,
      sourceName: true, description: true, imageUrl: true, priceCents: true,
      admission: true, ticketUrl: true, createdAt: true, updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // Group by venue first — only same-venue shows can be the same show — then
  // cluster within it by title similarity rather than an exact key.
  const byVenue = new Map<string, typeof rows>()
  for (const r of rows) byVenue.set(r.venueId, [...(byVenue.get(r.venueId) ?? []), r])

  const groups = new Map<string, typeof rows>()
  let g = 0
  for (const [venueId, venueRows] of byVenue) {
    const buckets: { key: string; rows: typeof rows }[] = []
    for (const r of venueRows) {
      const key = titleKey(r.title)
      const hit = buckets.find((b) => similarity(b.key, key) >= TITLE_SIMILARITY)
      hit ? hit.rows.push(r) : buckets.push({ key, rows: [r] })
    }
    for (const b of buckets) groups.set(`${venueId}::${g++}`, b.rows)
  }

  let merged = 0
  for (const group of groups.values()) {
    if (group.length < 2) continue

    // Only merge when the runs actually coincide; a venue can repeat a title.
    const clusters: (typeof group)[] = []
    for (const row of group) {
      const hit = clusters.find((c) => c.some((x) => overlaps(x, row)))
      hit ? hit.push(row) : clusters.push([row])
    }

    for (const cluster of clusters) {
      if (cluster.length < 2) continue

      // The venue's own site beats an aggregator: better prose, better prices.
      // Preference order: hand-curated, then the venue's own site, then an
      // aggregator — in increasing order of how much the data was second-hand.
      const rank = (src: string | null) =>
        src === 'curated' ? 0 : (!src || /arte\.it|milanotoday/.test(src)) ? 2 : 1
      // Tie-break on recency: when two rows come from the same kind of source,
      // the one written most recently reflects current truth. That matters for
      // curated rows, where a corrected seed entry must beat the stale one it
      // replaces rather than losing to it on creation order.
      const canonical = [...cluster].sort((a, b) =>
        rank(a.sourceName) - rank(b.sourceName) ||
        b.updatedAt.getTime() - a.updatedAt.getTime(),
      )[0]
      const losers = cluster.filter((c) => c.id !== canonical.id)

      console.log(`   merge ${cluster.length} → "${canonical.title.slice(0, 44)}" (keep ${canonical.sourceName ?? 'curated'})`)
      if (DRY) { merged += losers.length; continue }

      // Fill gaps in the canonical row from the ones being dropped rather than
      // discarding their better fields.
      const fill = {
        ...(!canonical.description ? { description: losers.find((l) => l.description)?.description } : {}),
        ...(!canonical.imageUrl    ? { imageUrl:    losers.find((l) => l.imageUrl)?.imageUrl }       : {}),
        ...(!canonical.ticketUrl   ? { ticketUrl:   losers.find((l) => l.ticketUrl)?.ticketUrl }     : {}),
        ...(canonical.admission === 'UNKNOWN'
              ? (() => { const l = losers.find((x) => x.admission !== 'UNKNOWN')
                         return l ? { admission: l.admission, priceCents: l.priceCents } : {} })()
              : {}),
      }
      if (Object.keys(fill).length) {
        await prisma.exhibition.update({ where: { id: canonical.id }, data: fill })
      }

      // Move saves across before deleting, or a user silently loses a bookmark.
      for (const l of losers) {
        await prisma.bookmark.updateMany({ where: { exhibitionId: l.id }, data: { exhibitionId: canonical.id } })
          .catch(() => {/* unique clash means the user already has the canonical one */})
        await prisma.bookmark.deleteMany({ where: { exhibitionId: l.id } })
        await prisma.favorite.deleteMany({ where: { exhibitionId: l.id } })
        await prisma.exhibitionArtForm.deleteMany({ where: { exhibitionId: l.id } })
        await prisma.exhibition.delete({ where: { id: l.id } })
        merged++
      }
    }
  }

  console.log(`   merged ${merged} duplicate row(s)`)
  return merged
}

// ─── 3. Link openings to their exhibition ─────────────────────────────────────

async function linkOpenings() {
  console.log(`\n── Openings`)

  const openings = await prisma.exhibition.findMany({
    where: { format: 'OPENING', parentId: null, withdrawnAt: null },
    select: { id: true, title: true, venueId: true, startsOn: true },
  })

  let linked = 0
  for (const o of openings) {
    if (!o.startsOn) continue

    // A vernissage happens on, or just before, the day the show opens.
    const from = new Date(o.startsOn); from.setUTCDate(from.getUTCDate() - 1)
    const to   = new Date(o.startsOn); to.setUTCDate(to.getUTCDate() + 1)

    const parent = await prisma.exhibition.findFirst({
      where: {
        venueId: o.venueId,
        format: 'EXHIBITION',
        run: 'TEMPORARY',
        startsOn: { gte: from, lte: to },
        id: { not: o.id },
      },
      orderBy: { startsOn: 'asc' },
    })
    if (!parent) continue

    if (!DRY) await prisma.exhibition.update({ where: { id: o.id }, data: { parentId: parent.id } })
    console.log(`   ${o.title.slice(0, 38)} → ${parent.title.slice(0, 38)}`)
    linked++
  }

  console.log(`   linked ${linked} of ${openings.length} unlinked opening(s)`)
  return linked
}

async function main() {
  console.log(`🔁 Reconciling${DRY ? ' (dry run)' : ''}`)

  const health = readHealth()
  if (!health) {
    console.log('\n── Takedowns')
    console.log('   no source-health report found — skipping takedown detection.')
    console.log('   (the scraper writes logs/last-run-sources.json; run it first)')
  } else {
    await detectTakedowns(health)
  }

  await mergeDuplicates()
  await linkOpenings()

  console.log('\n─────────────────────────────────────────')
  console.log(DRY ? '  dry run — nothing written' : '  reconciliation complete')
  console.log('─────────────────────────────────────────')
}

main()
  .catch((err) => { console.error('Fatal error:', err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
