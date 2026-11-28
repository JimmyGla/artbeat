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
   * Most detail pages to crawl from the listing (default 20). Set it above the
   * size of the source's whole programme: a run that reaches the cap is marked
   * truncated, and takedown detection then ignores the source.
   */
  maxLinks?: number
  /**
   * Why this source is here, and anything known about how it behaves. Written
   * down because "why are we crawling this" is the first question when a source
   * starts failing.
   */
  note: string
}

// Single-venue sources: their listing pages only ever show their own programme,
// so the venue is known without resolving anything.
const TRIENNALE_VENUE: ResolvedVenue = {
  name: 'Triennale Milano', address: 'Viale Alemagna 6, 20121 Milano', type: VenueKind.MUSEUM,
}

export const SOURCES: Source[] = [
  {
    label: 'arte.it',
    url: 'https://www.arte.it/calendario-arte/milano',
    // Milan only. The listing's sidebar and footer link to other cities'
    // shows (calendario-arte/bari/mostra-…) and to news articles whose slug
    // contains "mostra-"; the old /arte\.it\/.*mostra-/ matched those too.
    linkRe: /arte\.it\/calendario-arte\/milano\/mostra-/,
    // The listing's first page already links every current Milan show (63 on
    // 2026-11-27); its ?p=2… pages only show slices of the same set, so there
    // is nothing to paginate. The old cap of 20 was ours, not arte.it's.
    maxLinks: 150,
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
    label: 'triennale',
    // The Italian exhibitions page. The old /en/events URL is a 404, which is
    // why this source found 0 links; the English /en/program/mostre errors.
    url: 'https://triennale.org/program/mostre',
    // Shows live at /eventi/<slug>. The listing also links the permanent
    // collections (Museo del Design Italiano …); their pages carry no dates,
    // so the scraper skips them and the curated seed covers them.
    linkRe: /triennale\.org\/eventi\/[a-z0-9-]+$/,
    venue: TRIENNALE_VENUE,
    note:
      'Next.js site, no JSON-LD; og:title/description/image are good. A show ' +
      'already on gives only its closing date ("Fino al 14 febbraio 2027"), so ' +
      "those rows have no start date; reconcile merges them with arte.it's " +
      'copy and keeps its start. robots.txt: none (the path serves the app).',
    detail: {
      // Name and subtitle are two lines of one <h1>.
      title: ['main h1'],
      // The red date line under the red "MOSTRA" label (which is uppercase).
      // Never the page body: a "fino al 30 novembre" promo banner is on every page.
      dates: ['main div.space-y-3 > div.text-fire:not(.uppercase)'],
    },
  },

  // ── Removed ────────────────────────────────────────────────────────────────
  //
  // mudec and fondazioneprada — dropped 2026-11-28: both block this scraper.
  // mudec.it puts every page, robots.txt included, behind a Cloudflare
  // challenge for our bot; fondazioneprada.org serves its home page but answers
  // its /project/ pages with "Sorry, you have been blocked". Both produced 0
  // events. Getting past that means pretending to be a browser, which we
  // decided against (see USER_AGENT in scrapeEvents.ts). arte.it lists both
  // venues' shows. To bring them back, ask each press office to allow-list
  // ArtBeatBot, then restore the entries from git history.
  //
  // milanotoday — dropped deliberately. It supplied 1 of 36 rows, and its
  // robots.txt opens with a copyright notice prohibiting scraping "for any
  // commercial purposes" and for "development of any software, machine
  // learning, artificial intelligence" without written permission from Citynews
  // SpA. A single row is not worth that exposure. Ask Citynews for permission if
  // the coverage ever matters.
]
