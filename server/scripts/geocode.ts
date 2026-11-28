/**
 * Address → coordinates via Nominatim.
 *
 * Returns null on any failure.  It used to fall back to the Milan city centre,
 * which made a failed lookup indistinguishable from a real location and put
 * pins on the Duomo.  Callers must treat null as "unknown" and flag the venue
 * as a placeholder instead.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

/** Nominatim's usage policy asks for max 1 request/second. */
const MIN_INTERVAL_MS = 1100
let lastCall = 0

export interface Coords { lat: number; lng: number }

export async function geocode(address: string, cityHint = 'Milan, Italy'): Promise<Coords | null> {
  if (!address || address.trim().length < 8) return null

  const wait = MIN_INTERVAL_MS - (Date.now() - lastCall)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()

  try {
    const query = encodeURIComponent(`${address}, ${cityHint}`)
    const res = await fetch(`${NOMINATIM}?q=${query}&format=json&limit=1`, {
      headers: { 'User-Agent': 'ArtBeat-Scraper/1.0 (+https://github.com/artbeat)' },
    })
    if (!res.ok) return null

    const data = (await res.json()) as Array<{ lat: string; lon: string }>
    if (!data.length) return null

    const lat = parseFloat(data[0].lat)
    const lng = parseFloat(data[0].lon)
    return isNaN(lat) || isNaN(lng) ? null : { lat, lng }
  } catch {
    return null
  }
}

// ─── Venue geocoding with fallbacks ──────────────────────────────────────────
//
// `geocode` appends "Milan, Italy" to everything, which broke every venue
// outside the city ("…, Vimercate, Milan, Italy" finds nothing), and it takes
// Nominatim's first hit on trust. Listing sites also write addresses Nominatim
// cannot parse ("Via A. Manzoni 45"). So for scraped venues: try the address,
// then the venue's own name, and accept a hit only when it lies in the town
// the address names. Without that check, "Via Manzoni 45, Milano" lands in
// Vignate, 15 km away.

/** Fold "Milan" into "milano", accents and case, for comparing town names. */
function normTown(s: string): string {
  const t = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
  return t === 'milan' ? 'milano' : t
}

/**
 * The town an address ends with: "Via Frova 10, Cinisello Balsamo" →
 * "Cinisello Balsamo", "Piazza del Duomo 12, 20122 Milano" → "Milano".
 * Undefined when the address names no town.
 */
export function townOf(address: string): string | undefined {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return undefined
  const last = parts[parts.length - 1].replace(/\b\d{5}\b/g, '').replace(/\b(italy|italia)\b/i, '').trim()
  if (!last || /\d/.test(last) || /^(via|viale|piazza|piazzale|corso|largo|vicolo|foro)\b/i.test(last)) return undefined
  return last
}

/** The queries to try for a venue, in order, each with the town it must land in. */
export function venueGeocodeQueries(venue: { name: string; address: string }): { query: string; town: string }[] {
  const town = townOf(venue.address) ?? 'Milano'
  const queries = [
    townOf(venue.address) ? `${venue.address}, Italy` : `${venue.address}, ${town}, Italy`,
    `${venue.name}, ${town}`,
  ]
  // arte.it joins two names with " I " or a dash ("Acquario Civico I Museo di
  // Storia Naturale"); the first one alone usually finds the building.
  const head = venue.name.split(/\s+(?:I|\||–|-)\s+/)[0].trim()
  if (head && head !== venue.name.trim()) queries.push(`${head}, ${town}`)
  return [...new Set(queries)].map((query) => ({ query, town }))
}

/** Does a Nominatim `address` block place the hit in this town? */
export function inTown(address: Record<string, string> | undefined, town: string): boolean {
  if (!address) return false
  const want = normTown(town)
  return ['city', 'town', 'village'].some((k) => address[k] && normTown(address[k]) === want)
}

export async function geocodeVenue(venue: { name: string; address: string }): Promise<Coords | null> {
  for (const { query, town } of venueGeocodeQueries(venue)) {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCall)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastCall = Date.now()

    try {
      const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ArtBeat-Scraper/1.0 (+https://github.com/artbeat)' },
      })
      if (!res.ok) continue
      const data = (await res.json()) as Array<{ lat: string; lon: string; address?: Record<string, string> }>
      const hit = data[0]
      if (!hit || !inTown(hit.address, town)) continue
      const lat = parseFloat(hit.lat)
      const lng = parseFloat(hit.lon)
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng }
    } catch {
      // try the next query
    }
  }
  return null
}
