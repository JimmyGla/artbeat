import { prisma } from './prisma'

export interface NearbyEvent {
  id: string
  title: string
  startDate: Date
  endDate: Date | null
  price: number | null
  imageUrl: string | null
  ticketUrl: string | null
  description: string
  venueName: string
  venueType: string
  venueLat: number
  venueLng: number
  categoryName: string
  categoryColor: string
  distanceM: number
}

/**
 * Find upcoming events within `radiusKm` kilometres of a point, filtered to
 * a specific city by slug. Uses PostGIS ST_DWithin on the fly — no geometry
 * column needed; lat/lng floats are cast to geography at query time.
 *
 * Requires PostGIS extension: CREATE EXTENSION IF NOT EXISTS postgis;
 */
export async function getEventsNearPoint(
  lat: number,
  lng: number,
  radiusKm: number,
  citySlug: string,
): Promise<NearbyEvent[]> {
  const radiusMeters = radiusKm * 1000

  const rows = await prisma.$queryRaw<NearbyEvent[]>`
    SELECT
      e.id,
      e.title,
      e."startDate",
      e."endDate",
      e.price,
      e."imageUrl",
      e."ticketUrl",
      e.description,
      v.name                                                     AS "venueName",
      v.type                                                     AS "venueType",
      v.lat                                                      AS "venueLat",
      v.lng                                                      AS "venueLng",
      c.name                                                     AS "categoryName",
      c.color                                                    AS "categoryColor",
      ST_Distance(
        ST_MakePoint(v.lng, v.lat)::geography,
        ST_MakePoint(${lng}, ${lat})::geography
      )                                                          AS "distanceM"
    FROM   "Event"    e
    JOIN   "Venue"    v    ON e."venueId"    = v.id
    JOIN   "Category" c    ON e."categoryId" = c.id
    JOIN   "City"     city ON v."cityId"     = city.id
    WHERE  city.slug = ${citySlug}
      AND  e."startDate" >= NOW()
      AND  ST_DWithin(
             ST_MakePoint(v.lng, v.lat)::geography,
             ST_MakePoint(${lng}, ${lat})::geography,
             ${radiusMeters}
           )
    ORDER BY "distanceM" ASC, e."startDate" ASC
  `

  return rows
}