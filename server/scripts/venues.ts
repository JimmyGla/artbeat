/**
 * Venue resolution for the scraper.
 *
 * The scraper used to fall back to a venue literally named "Milan" whenever a
 * source did not expose a location.  That silently attached most events to one
 * fake pin at the city centre, which made the map actively misleading.  This
 * module replaces that with an explicit cascade that FAILS CLOSED: if we cannot
 * establish a real venue, we say so rather than inventing one.
 */

import { VenueKind } from '@prisma/client'

export interface ResolvedVenue {
  name: string
  address: string
  type: VenueKind
}

// ─── Known Milan art venues ───────────────────────────────────────────────────
//
// Aggregator listings (MilanoToday, Arte.it) usually name the venue somewhere
// in the title or body even when they omit structured location data, so
// matching against a curated list recovers most of them.
//
// Addresses are deliberately street-level: coordinates come from geocoding at
// scrape time rather than being hardcoded here, so a wrong guess can never
// become a wrong pin.  `aliases` must be distinctive — a bare "Milano" or
// "Museo" would match half the internet.

interface VenueEntry {
  name:    string
  /**
   * Official site, used only as a place to *look for* published opening hours.
   *
   * A wrong domain here cannot produce wrong hours: scrapeHours refuses to
   * store anything from a page that does not name the venue. So the failure
   * mode is a venue with no hours, which the UI already handles. Left absent
   * where the official domain is not known with confidence.
   */
  website?: string
  address: string
  type:    VenueKind
  aliases: string[]
}

export const MILAN_VENUES: VenueEntry[] = [
  { name: 'Palazzo Reale',                    address: 'Piazza del Duomo 12, 20122 Milano',   type: VenueKind.HISTORIC_BUILDING,  aliases: ['palazzo reale'], website: 'https://www.palazzorealemilano.it/' },
  { name: 'Pinacoteca di Brera',              address: 'Via Brera 28, 20121 Milano',           type: VenueKind.MUSEUM,  aliases: ['pinacoteca di brera', 'pinacoteca brera'], website: 'https://pinacotecabrera.org/' },
  { name: 'Palazzo Citterio',                 address: 'Via Brera 12, 20121 Milano',           type: VenueKind.HISTORIC_BUILDING,  aliases: ['palazzo citterio'] },
  { name: "Gallerie d'Italia",                address: 'Piazza della Scala 6, 20121 Milano',   type: VenueKind.MUSEUM,  aliases: ["gallerie d'italia", 'gallerie ditalia'], website: 'https://www.gallerieditalia.com/' },
  { name: 'MUDEC – Museo delle Culture',      address: 'Via Tortona 56, 20144 Milano',         type: VenueKind.MUSEUM,  aliases: ['mudec', 'museo delle culture'], website: 'https://www.mudec.it/' },
  { name: 'Triennale Milano',                 address: 'Viale Alemagna 6, 20121 Milano',       type: VenueKind.MUSEUM,  aliases: ['triennale'], website: 'https://triennale.org/' },
  { name: 'Fondazione Prada',                 address: 'Largo Isarco 2, 20139 Milano',         type: VenueKind.FOUNDATION, aliases: ['fondazione prada'], website: 'https://www.fondazioneprada.org/' },
  { name: 'Pirelli HangarBicocca',            address: 'Via Chiese 2, 20126 Milano',           type: VenueKind.GALLERY, aliases: ['hangarbicocca', 'hangar bicocca'], website: 'https://pirellihangarbicocca.org/' },
  { name: 'Museo del Novecento',              address: 'Piazza del Duomo 8, 20123 Milano',     type: VenueKind.MUSEUM,  aliases: ['museo del novecento'], website: 'https://www.museodelnovecento.org/' },
  { name: "PAC – Padiglione d'Arte Contemporanea", address: 'Via Palestro 14, 20121 Milano',   type: VenueKind.GALLERY, aliases: ["padiglione d'arte contemporanea", 'pac milano'], website: 'https://www.pacmilano.it/' },
  { name: "GAM – Galleria d'Arte Moderna",    address: 'Via Palestro 16, 20121 Milano',        type: VenueKind.MUSEUM,  aliases: ["galleria d'arte moderna", 'gam milano'], website: 'https://www.gam-milano.com/' },
  { name: 'Castello Sforzesco',               address: 'Piazza Castello, 20121 Milano',        type: VenueKind.HISTORIC_BUILDING,  aliases: ['castello sforzesco'], website: 'https://www.milanocastello.it/' },
  { name: 'Museo Poldi Pezzoli',              address: 'Via Manzoni 12, 20121 Milano',         type: VenueKind.HOUSE_MUSEUM,  aliases: ['poldi pezzoli'], website: 'https://museopoldipezzoli.it/' },
  { name: 'Armani/Silos',                     address: 'Via Bergognone 40, 20144 Milano',      type: VenueKind.GALLERY, aliases: ['armani/silos', 'armani silos'], website: 'https://www.armanisilos.com/' },
  { name: 'ADI Design Museum',                address: "Piazza Compasso d'Oro 1, 20154 Milano", type: VenueKind.MUSEUM, aliases: ['adi design museum'], website: 'https://www.adidesignmuseum.org/' },
  { name: 'Fabbrica del Vapore',              address: 'Via Giulio Cesare Procaccini 4, 20154 Milano', type: VenueKind.OTHER, aliases: ['fabbrica del vapore'], website: 'https://www.fabbricadelvapore.org/' },
  { name: 'Palazzo Morando',                  address: "Via Sant'Andrea 6, 20121 Milano",      type: VenueKind.HOUSE_MUSEUM,  aliases: ['palazzo morando'] },
  { name: 'Villa Necchi Campiglio',           address: 'Via Mozart 14, 20122 Milano',          type: VenueKind.HOUSE_MUSEUM,  aliases: ['villa necchi'] },
  { name: 'Rotonda della Besana',             address: 'Via Enrico Besana 12, 20122 Milano',   type: VenueKind.HISTORIC_BUILDING,   aliases: ['rotonda della besana', 'rotonda di via besana'] },
  { name: 'Museo Nazionale Scienza e Tecnologia', address: 'Via San Vittore 21, 20123 Milano', type: VenueKind.MUSEUM,  aliases: ['museo nazionale della scienza', 'museo nazionale scienza'], website: 'https://www.museoscienza.org/' },
  { name: 'Fondazione Feltrinelli',           address: 'Viale Pasubio 5, 20154 Milano',        type: VenueKind.FOUNDATION,   aliases: ['fondazione feltrinelli'] },
  { name: 'Teatro alla Scala',                address: 'Via Filodrammatici 2, 20121 Milano',   type: VenueKind.THEATER, aliases: ['teatro alla scala', 'la scala'] },

  // Added after auditing which venues the aggregator titles actually named.
  { name: 'Museo Bagatti Valsecchi',          address: 'Via Gesù 5, 20121 Milano',             type: VenueKind.HOUSE_MUSEUM,  aliases: ['bagatti valsecchi'], website: 'https://museobagattivalsecchi.org/' },
  { name: 'Museo Diocesano Carlo Maria Martini', address: 'Corso di Porta Ticinese 95, 20123 Milano', type: VenueKind.CHURCH, aliases: ['museo diocesano'] },
  { name: 'Fondazione Luciana Matalon',       address: 'Foro Buonaparte 67, 20121 Milano',     type: VenueKind.FOUNDATION, aliases: ['luciana matalon', 'fondazione matalon'] },
  { name: 'GióMARCONI',                       address: 'Via Alessandro Tadino 15, 20124 Milano', type: VenueKind.GALLERY, aliases: ['giomarconi', 'gio marconi'] },
  { name: 'Galleria Crédit Agricole',         address: 'Via Armorari 4, 20123 Milano',         type: VenueKind.GALLERY, aliases: ['credit agricole'] },
  { name: 'Biblioteca Nazionale Braidense',   address: 'Via Brera 28, 20121 Milano',           type: VenueKind.OTHER,   aliases: ['biblioteca nazionale braidense', 'braidense'], website: 'https://www.braidense.it/' },
  { name: 'BASE Milano',                      address: 'Via Bergognone 34, 20144 Milano',      type: VenueKind.OTHER,   aliases: ['base milano'], website: 'https://base.milano.it/' },
]

/**
 * Normalise text before matching.
 *
 * Italian venue names are full of apostrophes, and sources mix the ASCII `'`
 * with the typographic `’` — so "Galleria d’Arte Moderna" silently failed to
 * match an alias written with `'`.  Accents vary too ("Crédit"/"Credit").
 * Fold both, plus whitespace, so matching is not at the mercy of typography.
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

// Longest aliases first so "pinacoteca di brera" wins over a bare "brera".
const ALIAS_INDEX: { alias: string; entry: VenueEntry }[] = MILAN_VENUES
  .flatMap((entry) => entry.aliases.map((alias) => ({ alias: normalizeForMatch(alias), entry })))
  .sort((a, b) => b.alias.length - a.alias.length)

/**
 * Names that are not venues.  Sources frequently put the city, the publication,
 * or a section label where a venue should be; accepting those is what produced
 * the fake "Milan" venue in the first place.
 */
const NOT_A_VENUE = [
  'milan', 'milano', 'italy', 'italia', 'lombardia',
  'arte.it', 'milanotoday', 'mostra', 'mostre', 'evento', 'eventi',
  'exhibition', 'home', 'various', 'varie', 'tbd', 'n/a',
]

export function isUsableVenueName(raw: string | undefined | null): boolean {
  if (!raw) return false
  const name = raw.trim()
  // Single words and very short strings are almost always a city or a label.
  if (name.length < 4) return false
  return !NOT_A_VENUE.includes(name.toLowerCase())
}

/** Best-effort venue kind from the name, so the chip is not always "Venue". */
export function inferVenueKind(name: string): VenueKind {
  const n = name.toLowerCase()
  if (/\b(museo|museum|pinacoteca|mudec)\b/.test(n))              return VenueKind.MUSEUM
  if (/\b(galleria|gallery|gallerie|fondazione|foundation)\b/.test(n)) return VenueKind.GALLERY
  if (/\b(teatro|theatre|theater|auditorium)\b/.test(n))          return VenueKind.THEATER
  // OUTDOOR is not a VenueKind — public spaces are OTHER.
  if (/\b(parco|park|giardin|piazza|outdoor)\b/.test(n))          return VenueKind.OTHER
  return VenueKind.OTHER
}

/** Match any known venue mentioned in free text (title, description, page body). */
export function matchKnownVenue(...texts: (string | undefined | null)[]): ResolvedVenue | null {
  const haystack = normalizeForMatch(texts.filter(Boolean).join(' \n '))
  if (!haystack) return null

  for (const { alias, entry } of ALIAS_INDEX) {
    if (haystack.includes(alias)) {
      return { name: entry.name, address: entry.address, type: entry.type }
    }
  }
  return null
}

/**
 * Resolve a venue, in descending order of trustworthiness:
 *
 *   1. structured JSON-LD `location` (the source told us explicitly)
 *   2. the source's own venue, for single-venue sites like MUDEC
 *   3. a known Milan institution named in the text
 *
 * Returns `null` when none apply.  Callers must treat that as "unknown
 * location" — never as an excuse to substitute the city centre.
 */
export function resolveVenue(input: {
  jsonLdLocation?: { name?: string; address?: unknown } | null
  sourceVenue?:    ResolvedVenue | null
  title?:          string
  description?:    string
  pageText?:       string
}): ResolvedVenue | null {
  const { jsonLdLocation, sourceVenue, title, description, pageText } = input

  // 1 — structured data.
  const ldName = jsonLdLocation?.name?.trim()
  if (isUsableVenueName(ldName)) {
    // Prefer the curated address/type when we recognise the place; a bare
    // JSON-LD name often geocodes poorly on its own.
    const known = matchKnownVenue(ldName)
    if (known) return known

    const rawAddr = jsonLdLocation?.address
    const address =
      typeof rawAddr === 'string'
        ? rawAddr
        : [
            (rawAddr as any)?.streetAddress,
            (rawAddr as any)?.postalCode,
            (rawAddr as any)?.addressLocality,
          ].filter(Boolean).join(', ')

    return {
      name:    ldName!,
      address: address || `${ldName}, Milano`,
      type:    inferVenueKind(ldName!),
    }
  }

  // 2 — single-venue source.
  if (sourceVenue) return sourceVenue

  // 3 — a known institution mentioned anywhere in the page.
  return matchKnownVenue(title, description, pageText)
}
