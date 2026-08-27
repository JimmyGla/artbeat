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
