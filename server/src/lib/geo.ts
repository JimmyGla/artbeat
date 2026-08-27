import { prisma } from './prisma'

export interface NearbyExhibition {
  id: string
  title: string
  run: 'PERMANENT' | 'TEMPORARY'
  format: string
  startsOn: Date | null
  endsOn: Date | null
  admission: 'FREE' | 'PAID' | 'UNKNOWN'
  priceCents: number | null
  imageUrl: string | null
  ticketUrl: string | null
  description: string
  venueId: string
  venueName: string
  venueKind: string
  venueLat: number
  venueLng: number
  distanceM: number
}

/**
 * Exhibitions on now within `radiusKm` of a point, in one city.
 *
 * Uses PostGIS ST_DWithin on the fly — no geometry column needed; lat/lng
 * floats are cast to geography at query time.
 * Requires: CREATE EXTENSION IF NOT EXISTS postgis;
 *
 * This is raw SQL, so it is invisible to TypeScript: the Event → Exhibition
 * rename broke it silently and only a vocabulary grep caught it. If you rename
 * anything again, grep the raw queries by hand.
 *
 * The `stillOn` predicate cannot be reused here because it returns a Prisma
 * `where` object, so the same rule is spelled out in SQL below — keep the two
 * in step.
 */
export async function getExhibitionsNearPoint(
  lat: number,
  lng: number,
  radiusKm: number,
  citySlug: string,
): Promise<NearbyExhibition[]> {
  const radiusMeters = radiusKm * 1000

  const rows = await prisma.$queryRaw<NearbyExhibition[]>`
    SELECT
      e.id,
      e.run::text                                                AS "run",
      e.format::text                                             AS "format",
      e.title,
      e."startDate"                                              AS "startsOn",
      e."endDate"                                                AS "endsOn",
      e.admission::text                                          AS "admission",
      e."priceCents",
      e."imageUrl",
      e."ticketUrl",
      e.description,
      v.id                                                       AS "venueId",
      v.name                                                     AS "venueName",
      v.kind::text                                               AS "venueKind",
      v.lat                                                      AS "venueLat",
      v.lng                                                      AS "venueLng",
      ST_Distance(
        ST_MakePoint(v.lng, v.lat)::geography,
        ST_MakePoint(${lng}, ${lat})::geography
      )                                                          AS "distanceM"
    FROM   "Exhibition" e
    JOIN   "Venue"      v    ON e."venueId" = v.id
    JOIN   "City"       city ON v."cityId"  = city.id
    WHERE  city.slug = ${citySlug}
      -- Placeholder venues carry city-centre coordinates, so a proximity
      -- search would rank them as nearby when their location is unknown.
      AND  v."isPlaceholder" = false
      -- Mirrors lib/eventFilters.stillOn(): not withdrawn, and then permanent,
      -- still running, or undated and not yet started.
      --
      -- The withdrawal check was missing here while the comment already claimed
      -- to mirror stillOn — latent only because nothing had been withdrawn yet.
      -- Exactly the drift the header warns about.
      AND  e."withdrawnAt" IS NULL
      AND  (
             e.run = 'PERMANENT'
             OR e."endDate" >= CURRENT_DATE
             OR (e."endDate" IS NULL AND e."startDate" >= CURRENT_DATE)
           )
      AND  ST_DWithin(
             ST_MakePoint(v.lng, v.lat)::geography,
             ST_MakePoint(${lng}, ${lat})::geography,
             ${radiusMeters}
           )
    ORDER BY "distanceM" ASC, e."startDate" ASC NULLS FIRST
  `

  return rows
}
