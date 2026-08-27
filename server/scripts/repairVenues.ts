/**
 * One-off repair for venues created by the old scraper.
 *
 * The previous resolver fell back to a venue literally named after the city
 * ("Milan") whenever a source exposed no location, so most events ended up on
 * a single fake pin at the city centre.  This script:
 *
 *   1. flags junk venues (named after their own city, or unnamed) as
 *      placeholders, so the map stops drawing them immediately;
 *   2. re-resolves their events offline, by matching the curated venue list
 *      against each event's stored title and description — no network, no
 *      re-crawling the sources;
 *   3. geocodes any venue it newly creates or promotes.
 *
 * Idempotent: safe to run repeatedly.  Run with `npm run db:repair-venues`.
 */

import { PrismaClient, VenueType } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { matchKnownVenue, isUsableVenueName, inferVenueKind } from './venues'
import { geocode } from './geocode'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 ArtBeat venue repair\n')

  const cities = await prisma.city.findMany()

  // ── 1. Flag junk venues ────────────────────────────────────────────────────
  let flagged = 0
  for (const city of cities) {
    const venues = await prisma.venue.findMany({ where: { cityId: city.id } })

    for (const v of venues) {
      const isJunk =
        !isUsableVenueName(v.name) ||
        v.name.trim().toLowerCase() === city.name.toLowerCase()

      if (isJunk && !v.isPlaceholder) {
        await prisma.venue.update({ where: { id: v.id }, data: { isPlaceholder: true } })
        console.log(`  flagged placeholder: ${JSON.stringify(v.name)} (${city.name})`)
        flagged++
      }
    }
  }
  console.log(`\n  ${flagged} venue(s) newly flagged as placeholders\n`)

  // ── 2. Re-resolve events sitting on placeholder venues ────────────────────
  const stranded = await prisma.exhibition.findMany({
    where:  { venue: { isPlaceholder: true } },
    select: {
      id: true, title: true, description: true,
      venue: { select: { cityId: true, city: { select: { name: true } } } },
    },
  })

  console.log(`  ${stranded.length} event(s) on placeholder venues — attempting offline re-resolve\n`)

  let moved = 0
  let stillUnknown = 0

  for (const ev of stranded) {
    const match = matchKnownVenue(ev.title, ev.description)
    if (!match) { stillUnknown++; continue }

    const cityId = ev.venue.cityId

    let venue = await prisma.venue.findFirst({
      where: { cityId, name: { equals: match.name, mode: 'insensitive' } },
    })

    if (!venue || venue.isPlaceholder) {
      const coords = await geocode(match.address, `${ev.venue.city.name}, Italy`)

      if (venue) {
        venue = await prisma.venue.update({
          where: { id: venue.id },
          data: {
            address: match.address,
            kind: match.type,
            ...(coords ? { lat: coords.lat, lng: coords.lng, isPlaceholder: false } : {}),
          },
        })
      } else {
        if (!coords) {
          // Cannot place it — leave the event where it is rather than minting
          // another venue with fake coordinates.
          stillUnknown++
          continue
        }
        venue = await prisma.venue.create({
          data: {
            name: match.name, address: match.address,
            lat: coords.lat, lng: coords.lng,
            kind: match.type ?? inferVenueKind(match.name),
            type: VenueType.OTHER,
            isPlaceholder: false, cityId,
          },
        })
        console.log(`  + created venue: ${match.name}`)
      }
    }

    if (venue.isPlaceholder) { stillUnknown++; continue }

    await prisma.exhibition.update({ where: { id: ev.id }, data: { venueId: venue.id } })
    console.log(`  → "${ev.title.slice(0, 52)}" ⇒ ${venue.name}`)
    moved++
  }

  // ── 3. Correct venue types ────────────────────────────────────────────────
  // The curated list is authoritative — name inference gets "Palazzo Reale"
  // wrong (no keyword to go on) and miscategorises "Gallerie d'Italia" as a
  // commercial gallery.  Fall back to inference only for unknown venues.
  let retyped = 0
  const realVenues = await prisma.venue.findMany({ where: { isPlaceholder: false } })
  for (const v of realVenues) {
    const correct = matchKnownVenue(v.name)?.type ?? inferVenueKind(v.name)
    if (correct !== v.kind) {
      await prisma.venue.update({ where: { id: v.id }, data: { kind: correct } })
      console.log(`  kind: ${v.name} ${v.kind} → ${correct}`)
      retyped++
    }
  }

  console.log('\n─────────────────────────────────────────')
  console.log(`  Re-homed events     : ${moved}`)
  console.log(`  Still unlocated     : ${stillUnknown}`)
  console.log(`  Venue types inferred: ${retyped}`)
  console.log('─────────────────────────────────────────')
  console.log('\nUnlocated events remain visible in Discover but are withheld')
  console.log('from the map. Re-run the scraper to resolve more of them.')
}

main()
  .catch((err) => { console.error('Fatal error:', err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
