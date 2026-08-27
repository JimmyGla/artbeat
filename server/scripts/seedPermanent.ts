/**
 * Seed permanent collections from data/permanent-collections.json.
 *
 * Permanent collections are curated, not crawled: listing sites do not
 * advertise them because they are not news, so no scraper will ever find them.
 * They are also the app's most durable content — always accurate, never
 * expiring, immune to a broken selector.
 *
 * Idempotent. Matches on venue + title, so editing the JSON updates the row
 * instead of creating a second one. Rows are marked `sourceName: 'curated'`,
 * which is also how takedown detection knows to leave them alone.
 *
 * Run with `npm run db:seed-permanent`. Pass `--dry` to preview.
 */

import { PrismaClient, Admission, VenueType } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { MILAN_VENUES, normalizeForMatch } from './venues'
import { geocode } from './geocode'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const prisma = new PrismaClient()
const DRY = process.argv.includes('--dry')

export const CURATED_SOURCE = 'curated'

interface CollectionSeed {
  venue:        string
  title:        string
  description:  string
  artForms:     string[]
  admission:    'FREE' | 'PAID' | 'UNKNOWN'
  priceCents?:  number
}

async function main() {
  console.log(`🏛  Seeding permanent collections${DRY ? ' (dry run)' : ''}\n`)

  const file = path.resolve(__dirname, '../data/permanent-collections.json')
  const { collections } = JSON.parse(fs.readFileSync(file, 'utf8')) as { collections: CollectionSeed[] }

  // Curated collections are Milan-only for now; when Rome opens this becomes a
  // per-city file.
  const city = await prisma.city.findFirst({ where: { slug: 'milan' } })
  if (!city) { console.error('✗ Milan not in the database.'); process.exitCode = 1; return }

  const artForms = await prisma.artForm.findMany({ select: { id: true, slug: true } })
  const artFormId = new Map(artForms.map((a) => [a.slug, a.id]))

  let created = 0, updated = 0
  const unmatchedVenues: string[] = []
  const unknownForms = new Set<string>()

  for (const c of collections) {
    // A venue only exists once an exhibition has landed on it, so several
    // museums we curate collections for are absent. The scraper's allowlist
    // already holds their address and kind, so create from that rather than
    // skipping — but never invent a venue we have no address for, which is the
    // rule the whole venue-resolution effort established.
    let venue = await prisma.venue.findFirst({
      where: { name: { equals: c.venue, mode: 'insensitive' } },
    })

    if (!venue) {
      const known = MILAN_VENUES.find(
        (v) => normalizeForMatch(v.name) === normalizeForMatch(c.venue),
      )
      if (!known) { unmatchedVenues.push(c.venue); continue }

      const coords = DRY ? null : await geocode(known.address)
      if (!DRY && !coords) {
        // No coordinates means no honest pin. Record it rather than placing one.
        unmatchedVenues.push(`${c.venue} (geocoding failed)`)
        continue
      }
      if (DRY) { console.log(`  would create venue  ${known.name}`); }
      else {
        venue = await prisma.venue.create({
          data: {
            name: known.name, address: known.address,
            lat: coords!.lat, lng: coords!.lng,
            kind: known.type,
            // `type` is the deprecated enum, still NOT NULL until it is dropped.
            type: VenueType.OTHER,
            isPlaceholder: false, cityId: city.id,
          },
        })
        console.log(`  + venue  ${known.name}`)
      }
      if (DRY) continue
    }

    const data = {
      title:       c.title,
      description: c.description,
      run:         'PERMANENT' as const,
      format:      'EXHIBITION' as const,
      // A permanent run has no dates at all — the CHECK constraint enforces it.
      startsOn:    null,
      endsOn:      null,
      admission:   c.admission as Admission,
      priceCents:  c.priceCents ?? null,
      venueId:     venue!.id,
      sourceName:  CURATED_SOURCE,
      lastSeenAt:  new Date(),
      missedRuns:  0,
      withdrawnAt: null,
    }

    const existing = await prisma.exhibition.findFirst({
      where: { venueId: venue!.id, title: { equals: c.title, mode: 'insensitive' } },
    })

    if (DRY) {
      console.log(`  ${existing ? 'update' : 'create'}  ${c.venue} → ${c.title.slice(0, 46)}`)
      existing ? updated++ : created++
      continue
    }

    const row = existing
      ? await prisma.exhibition.update({ where: { id: existing.id }, data })
      : await prisma.exhibition.create({ data })

    existing ? updated++ : created++

    // Tag media from the curated list rather than inferring them: a permanent
    // collection's media are known facts, not a guess from prose.
    const ids = c.artForms
      .map((slug) => { const id = artFormId.get(slug); if (!id) unknownForms.add(slug); return id })
      .filter((id): id is string => Boolean(id))

    if (ids.length) {
      await prisma.exhibitionArtForm.createMany({
        data: ids.map((id) => ({ exhibitionId: row.id, artFormId: id })),
        skipDuplicates: true,
      })
    }

    console.log(`  ${existing ? '~' : '+'} ${c.venue.padEnd(34)} ${c.title.slice(0, 42)}`)
  }

  console.log('\n─────────────────────────────────────────')
  console.log(`  Created : ${created}`)
  console.log(`  Updated : ${updated}`)
  if (unmatchedVenues.length) {
    console.log(`\n  ⚠ ${unmatchedVenues.length} venue(s) not in the database — skipped:`)
    unmatchedVenues.forEach((v) => console.log(`      ${v}`))
    console.log('    They appear once a scrape creates them, or add them by hand.')
  }
  if (unknownForms.size) {
    console.log(`\n  ⚠ unknown art form slug(s): ${[...unknownForms].join(', ')}`)
  }
  console.log('─────────────────────────────────────────')
}

main()
  .catch((err) => { console.error('Fatal error:', err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
