import { VenueKind } from '@prisma/client'
import type { ResolvedVenue } from './venues'

/**
 * One entry per source, with its own selectors.
 *
 * The scraper used a single generic listing crawler and a single detail parser
 * for every site, which is exactly why the failures looked the way they did:
 * mudec found 20 links and produced 1 event, Fondazione Prada found 6 and
 * produced 0. Those pages parse fine — the *selectors* did not fit them. A
 * shared parser can only ever fit the site it was written against.
 *
 * `detail` overrides are optional: when a site exposes good JSON-LD the generic
 * path already works, and adding selectors would be noise. Fill them in only
 * for sites that actually need it.
 */

export interface SourceDetailHints {
  /** CSS selectors tried in order for the exhibition title. */
  title?: string[]
  /** Selectors for real prose. Checked before the generic body-paragraph scan. */
  description?: string[]
  /** Selectors for the element containing the run dates. */
  dates?: string[]
  /** Selectors for ticket price text. */
  price?: string[]
}

export interface Source {
  label: string
  url: string
  /** Matches detail-page URLs on the listing page. */
  linkRe: RegExp
  /** Single-venue sites: every listing belongs to this venue. */
  venue?: ResolvedVenue
  /** Per-site selector hints; the generic extractors are the fallback. */
  detail?: SourceDetailHints
  /**
   * Why this source is here, and anything known about how it behaves. Written
   * down because "why are we crawling this" is the first question when a source
   * starts failing.
   */
  note: string
}

// Single-venue sources: their listing pages only ever show their own programme,
// so the venue is known without resolving anything.
const MUDEC_VENUE: ResolvedVenue = {
  name: 'MUDEC – Museo delle Culture', address: 'Via Tortona 56, 20144 Milano', type: VenueKind.MUSEUM,
}
const TRIENNALE_VENUE: ResolvedVenue = {
  name: 'Triennale Milano', address: 'Viale Alemagna 6, 20121 Milano', type: VenueKind.MUSEUM,
}
const PRADA_VENUE: ResolvedVenue = {
  name: 'Fondazione Prada', address: 'Largo Isarco 2, 20139 Milano', type: VenueKind.FOUNDATION,
}

export const SOURCES: Source[] = [
  {
    label: 'arte.it',
    url: 'https://www.arte.it/calendario-arte/milano',
    linkRe: /arte\.it\/.*mostra-/,
    note:
      'The aggregator carrying almost all coverage. Good JSON-LD for dates, but ' +
      'no og:description and no clean prose paragraph, which is why most of its ' +
      'events end up untagged. robots.txt allows all.',
    detail: {
      // arte.it puts the blurb in a content div rather than a <p>, which the
      // generic prose scan cannot see.
      description: ['.testo-scheda', '.scheda-testo', '#descrizione', '[itemprop="description"]'],
      dates: ['.date-scheda', '.scheda-date', '[itemprop="startDate"]'],
      price: ['.prezzo', '.biglietti', '[itemprop="price"]'],
    },
  },
  {
    label: 'mudec',
    url: 'https://www.mudec.it/mostre-in-corso/',
    linkRe: /mudec\.it\/[a-z0-9-]+\/?$/,
    venue: MUDEC_VENUE,
    note:
      'Finds ~20 links but yielded 1 event: the old link pattern matched every ' +
      'mudec.it URL including navigation, and the date format is not JSON-LD. ' +
      'robots.txt Content-Signal: search=yes, ai-train=no, use=reference — ' +
      'crawling for reference is sanctioned, training is not.',
    detail: {
      title: ['h1.title', 'h1', '.exhibition-title'],
      description: ['.exhibition-description', '.testo', 'article .content'],
      dates: ['.exhibition-dates', '.date', 'time'],
    },
  },
  {
    label: 'triennale',
    url: 'https://triennale.org/en/events/',
    linkRe: /triennale\.org\/en\/(events|exhibitions)\/[a-z0-9-]+/,
    venue: TRIENNALE_VENUE,
    note:
      'Returned 0 links: the grid is client-rendered and the old pattern also ' +
      'missed /exhibitions/ paths. Now waits for network idle and accepts both.',
    detail: {
      title: ['h1', '[class*="hero"] h1'],
      description: ['[class*="abstract"]', '[class*="description"]', 'article p'],
      dates: ['[class*="date"]', 'time'],
    },
  },
  {
    label: 'fondazioneprada',
    url: 'https://www.fondazioneprada.org/',
    linkRe: /fondazioneprada\.org\/project\//,
    venue: PRADA_VENUE,
    note:
      'Was blocked by Cloudflare until a browser user-agent was set; now finds ' +
      '6 links but 0 usable events because its dates are prose, not JSON-LD. ' +
      'Expect this one to need the date selectors below to work.',
    detail: {
      title: ['h1', '.project-title'],
      description: ['.project-description', '.abstract', 'article p'],
      dates: ['.project-dates', '.dates', 'time'],
    },
  },

  // ── Removed ────────────────────────────────────────────────────────────────
  //
  // milanotoday — dropped deliberately. It supplied 1 of 36 rows, and its
  // robots.txt opens with a copyright notice prohibiting scraping "for any
  // commercial purposes" and for "development of any software, machine
  // learning, artificial intelligence" without written permission from Citynews
  // SpA. A single row is not worth that exposure. Ask Citynews for permission if
  // the coverage ever matters.
]
