/**
 * ArtBeat — Milan Art Events Scraper (COMPLETE FULL FILE)
 */

import { chromium, Page } from 'playwright'
import { PrismaClient, VenueType } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { parseDate, parseDateRange } from './dateParser'
import { resolveVenue, inferVenueKind, ResolvedVenue } from './venues'
import { geocode } from './geocode'
import { parsePrice, matchFormat, looksFree, isValidEventTitle, isUsefulDescription } from './extractors'
import { matchArtForms } from './artFormMatcher'
import { SOURCES, type SourceDetailHints } from './sources'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const prisma = new PrismaClient()

// ─── Constants ────────────────────────────────────────────────────────────────
/**
 * Identify honestly.
 *
 * This was a Chrome string, set to get past Fondazione Prada's Cloudflare
 * check. It worked, but a scraper that impersonates a browser cannot be
 * allow-listed by a venue, and it misrepresents who is asking. Expect more
 * blocks with this — and the ability to email a press office and be let in.
 */
const USER_AGENT = 'ArtBeatBot/1.0 (+https://artbeat.app/bot; listings aggregator; contact: hello@artbeat.app)'
const DELAY_MS = 2000
const MAX_PER_SOURCE = 20

const MILAN_LAT = 45.4654
const MILAN_LNG = 9.1859

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScrapedEvent {
  title: string
  description: string
  startDate: Date
  endDate?: Date
  price?: number
  /** A source explicitly said free — not merely "no price found". */
  isFree?: boolean
  ticketUrl?: string
  imageUrl?: string
  /** null = no venue could be established; the event lands on the city's
   *  placeholder venue and is withheld from the map. */
  venue: ResolvedVenue | null
  source: string
}

/** Per-source outcome.  Links and events are tracked separately because they
 *  fail for different reasons and need different fixes — see the health block
 *  at the end of a run. */
interface SourceResult {
  events:    ScrapedEvent[]
  linkCount: number
}

interface UpsertStats {
  inserted: number
  updated: number
  skipped: number
  /** Events kept but with no resolvable location — visible in lists, not on the map. */
  unresolvedVenue: number
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Pin a parsed date to a UTC calendar day.
 *
 * `dateParser` already builds UTC midnight, so this is belt-and-braces for any
 * date that arrives from `new Date(...)` with a time attached — the column is
 * DATE and Postgres would truncate anyway, but truncating here keeps the value
 * we compare against in-process identical to the value we store.
 */
function toCalendarDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}





// ─── Extractors ───────────────────────────────────────────────────────────────
async function extractJsonLd(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    for (const script of scripts) {
      try {
        const raw = JSON.parse(script.textContent ?? '')
        const items = Array.isArray(raw) ? raw : [raw]
        for (const item of items) {
          const type = (item as any)?.['@type'] as string
          if (type && /Event|ExhibitionEvent|VisualArtsEvent/.test(type)) {
            return item as Record<string, unknown>
          }
        }
      } catch {
        // Malformed JSON-LD block — try the next one
      }
    }
    return null
  })
}

async function extractMeta(page: Page) {
  return page.evaluate(() => ({
    ogImage: (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content ?? '',
    ogTitle: (document.querySelector('meta[property="og:title"]') as HTMLMetaElement)?.content ?? '',
    ogDescription: (document.querySelector('meta[property="og:description"]') as HTMLMetaElement)?.content ?? '',
  }))
}


/**
 * First real prose paragraph of the article body, as a description fallback.
 *
 * A plain length-plus-keyword filter is not enough: on arte.it the first
 * qualifying `<p>` is the breadcrumb strip ("Home Notizie Guide Mostre …"),
 * which would have been stored as the description — worse than the title echo
 * it replaced.  So candidates must actually look like prose.
 */
async function extractBodyParagraph(page: Page): Promise<string> {
  return page.evaluate(() => {
    const scopes = ['article', 'main', '[class*="content"]', '[class*="testo"]', 'body']

    const junk = new RegExp([
      'cookie', 'privacy', 'newsletter', 'iscriviti', 'accetta', 'abbonati',
      'seguici', 'condividi', 'testata giornalistica', 'registro della stampa',
      'direttore responsabile', 'tutti i diritti', 'partita iva',
      'costo del biglietto', 'orari di apertura',
    ].join('|'), 'i')

    function looksLikeProse(text: string): boolean {
      if (text.includes('-->') || text.includes(' > ')) return false   // markup / breadcrumb
      if (junk.test(text)) return false

      const words = text.split(/\s+/).filter(Boolean)
      if (words.length < 20) return false

      // Navigation strips are mostly Capitalised single words; prose is not.
      const capitalised = words.filter((w) => /^[A-ZÀ-Ù]/.test(w)).length
      if (capitalised / words.length > 0.4) return false

      // Real prose has sentence punctuation somewhere.
      return /[.!?]/.test(text)
    }

    for (const scope of scopes) {
      const root = document.querySelector(scope)
      if (!root) continue
      for (const p of Array.from(root.querySelectorAll('p'))) {
        const text = (p.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (text.length >= 120 && text.length <= 1500 && looksLikeProse(text)) return text
      }
    }
    return ''
  }).catch(() => '')
}


/**
 * First non-empty text among a source's selectors. Returns '' when none match,
 * so callers can fall through to the generic extractors.
 */
async function firstMatch(page: Page, selectors?: string[]): Promise<string> {
  if (!selectors?.length) return ''
  for (const sel of selectors) {
    const text = await page
      .$eval(sel, (el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
      .catch(() => '')
    if (text) return text
  }
  return ''
}

// ─── Detail Scraper ───────────────────────────────────────────────────────────
async function scrapeDetailPage(
  page: Page,
  detailUrl: string,
  source: string,
  fallbackVenue?: ResolvedVenue,
  hints?: SourceDetailHints,
): Promise<ScrapedEvent | null> {
  try {
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(1500)

    const [jsonLd, meta] = await Promise.all([extractJsonLd(page), extractMeta(page)])

    // Per-source selectors first; JSON-LD and og: tags are the fallback, not
    // the other way round, because a site that needs hints needs them to win.
    const title =
      (await firstMatch(page, hints?.title)) ||
      (jsonLd?.['name'] as string) || meta.ogTitle ||
      await page.$eval('h1, .title, article h1', el => el.textContent?.trim() ?? '').catch(() => '')

    if (!isValidEventTitle(title)) return null

    // Description: take the first candidate that actually adds information.
    // Falling back to the title (as this used to) produced a description that
    // said nothing for 92% of events; an empty string is more honest, and the
    // UI hides the section entirely.
    let description = ''
    for (const candidate of [jsonLd?.['description'] as string, meta.ogDescription]) {
      if (candidate && isUsefulDescription(candidate, title)) { description = candidate.trim(); break }
    }
    if (!description) {
      // Site-specific containers before the generic prose scan: arte.it keeps
      // its blurb in a div, which the paragraph scan cannot see at all.
      const hinted = await firstMatch(page, hints?.description)
      if (hinted && isUsefulDescription(hinted, title)) description = hinted
    }
    if (!description) {
      const para = await extractBodyParagraph(page)
      if (isUsefulDescription(para, title)) description = para
    }

    let startDate = parseDate(jsonLd?.['startDate'] as string) || parseDate(meta.ogDescription)
    let endDate = parseDate(jsonLd?.['endDate'] as string)

    // The body-text range parse used to be gated on `!startDate`, so whenever
    // JSON-LD supplied a start date we never looked for an end date anywhere
    // else — leaving long-running exhibitions with a null endDate, which the
    // "still on" filter then treats as a one-off and hides. Read the body
    // whenever either date is still missing.
    if (!startDate || !endDate) {
      // A hinted date element is far less ambiguous than the whole page body,
      // which can contain any number of unrelated dates.
      const hintedDates = await firstMatch(page, hints?.dates)
      const dateText = hintedDates || await page.evaluate(() => document.body.innerText).catch(() => '')
      const range = parseDateRange(dateText)
      if (range) {
        startDate = startDate ?? range.start
        endDate   = endDate   ?? range.end
      }
    }
    if (!startDate) return null

    // Price. `isFree` is tracked separately from a missing price so that
    // "we found no number" never masquerades as free admission.
    let price: number | undefined
    let isFree = false
    if (jsonLd?.offers) {
      const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers
      price = parsePrice(String(offer?.price || ''))
    }
    if (!price) {
      const hintedPrice = await firstMatch(page, hints?.price)
      const priceText = hintedPrice || await page.evaluate(() => {
        const selectors = ['[class*="price"]', '[class*="ticket"]', '[class*="biglietto"]', '.prezzo', '.cost', 'strong', 'h3']
        for (const sel of selectors) {
          const el = document.querySelector(sel)
          if (el) return el.textContent || ''
        }
        return document.body.innerText
      })
      price = parsePrice(priceText)
      if (looksFree(priceText)) isFree = true
    }

    const imageUrl = meta.ogImage?.startsWith('http') ? meta.ogImage : undefined

    // Venue: structured data → single-venue source → known institution named
    // in the page.  `null` means unknown, and stays unknown — see venues.ts.
    const pageText = await page.evaluate(() => document.body.innerText.slice(0, 4000)).catch(() => '')
    const venue = resolveVenue({
      jsonLdLocation: (jsonLd?.['location'] as any) ?? null,
      sourceVenue:    fallbackVenue ?? null,
      title,
      description,
      pageText,
    })

    return {
      title,
      description,
      startDate,
      endDate,
      price,
      isFree,
      ticketUrl: detailUrl,
      imageUrl,
      venue,
      source
    }
  } catch (err) {
    console.warn(`  ⚠ Failed ${detailUrl}`)
    return null
  }
}

// ─── Generic Scraper ─────────────────────────────────────────────────────────
async function scrapeGeneric(
  page: Page,
  listingUrl: string,
  linkRegex: RegExp,
  source: string,
  fallbackVenue?: ResolvedVenue,
  hints?: SourceDetailHints,
): Promise<SourceResult> {
  const results: ScrapedEvent[] = []
  let linkCount = 0
  try {
    // Listing pages on these sites render their event grids client-side, so
    // `domcontentloaded` fires before any event link exists — which is why
    // three of five sources silently returned zero. Wait for the network to
    // settle, scroll to trigger lazy loading, then poll for a matching link
    // before giving up.
    await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    } catch {
      // Sites with long-polling or ads may never reach networkidle; carry on.
    }

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight))
      await sleep(700)
    }

    try {
      await page.waitForFunction(
        (regexStr: string) => {
          const re = new RegExp(regexStr)
          return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
            .some((a) => re.test(a.href.split('?')[0].split('#')[0]))
        },
        linkRegex.source,
        { timeout: 12000 },
      )
    } catch {
      // Falls through to the 0-links warning below.
    }

    const links = await page.evaluate((params: { max: number; regexStr: string }) => {
      const { max, regexStr } = params
      const re = new RegExp(regexStr)
      const seen = new Set<string>()
      return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .map(a => a.href)
        .filter(href => {
          const clean = href.split('?')[0].split('#')[0]
          if (!re.test(clean) || seen.has(clean)) return false
          seen.add(clean)
          return true
        })
        .slice(0, max)
    }, { max: MAX_PER_SOURCE, regexStr: linkRegex.source })

    // A source that suddenly yields nothing has almost certainly changed its
    // markup — the link regex no longer matches.  Say so loudly: this used to
    // pass silently, so a dead source looked identical to a quiet one.
    if (links.length === 0) {
      console.warn(`  ⚠ ${source}: 0 links matched — listing markup or link pattern has likely changed`)
    } else {
      console.log(`  ${source}: ${links.length} links found`)
    }
    linkCount = links.length

    for (const link of links) {
      await sleep(DELAY_MS)
      const event = await scrapeDetailPage(page, link, source, fallbackVenue, hints)
      if (event) {
        results.push(event)
        console.log(`    ✓ ${event.title} | Price: ${event.price ?? 'NULL'}`)
      }
    }
  } catch (err) {
    console.warn(`  ${source} failed: ${(err as Error).message}`)
  }
  return { events: results, linkCount }
}


// ─── DB Helpers ───────────────────────────────────────────────────────────────
async function getMilanCity() {
  return prisma.city.upsert({
    where: { slug: 'milan' },
    update: {},
    create: { name: 'Milan', slug: 'milan', country: 'Italy', lat: MILAN_LAT, lng: MILAN_LNG, isActive: true }
  })
}

/** Single per-city bucket for events whose location we could not establish. */
/**
 * Art-form ids by slug, loaded once. Tagging happens at write time so new rows
 * arrive already classified; `db:tag-art-forms` is only for the back catalogue.
 */
let artFormIds: Map<string, string> | null = null
async function getArtFormIds(): Promise<Map<string, string>> {
  if (!artFormIds) {
    const forms = await prisma.artForm.findMany({ select: { id: true, slug: true } })
    artFormIds = new Map(forms.map((f) => [f.slug, f.id]))
  }
  return artFormIds
}

/** Add any missing medium tags. Never removes one — a human may have fixed it. */
async function tagArtForms(exhibitionId: string, title: string, description: string) {
  const slugs = matchArtForms(title, description)
  if (slugs.length === 0) return

  const ids = await getArtFormIds()
  const data = slugs
    .map((s) => ids.get(s))
    .filter((id): id is string => Boolean(id))
    .map((artFormId) => ({ exhibitionId, artFormId }))

  if (data.length) await prisma.exhibitionArtForm.createMany({ data, skipDuplicates: true })
}

async function getPlaceholderVenue(cityId: string, cityName: string, lat: number, lng: number) {
  const name = `Location not confirmed — ${cityName}`
  const existing = await prisma.venue.findFirst({ where: { cityId, name } })
  if (existing) return existing

  return prisma.venue.create({
    data: {
      name,
      address:       cityName,
      lat, lng,                      // city centre, never shown on the map
      type:          VenueType.OTHER,
      isPlaceholder: true,
      cityId,
    },
  })
}

async function getOrCreateVenue(venue: ResolvedVenue, cityId: string) {
  // Scoped by city: the old lookup matched on name alone, so a venue called
  // "Centrale" in Milan would have been reused for Rome.
  const existing = await prisma.venue.findFirst({
    where: { cityId, name: { equals: venue.name, mode: 'insensitive' } }
  })

  // A venue previously stored without coordinates can be upgraded once
  // geocoding starts working for it.
  if (existing && !existing.isPlaceholder) return existing

  const coords = await geocode(venue.address)

  if (existing) {
    if (!coords) return existing
    return prisma.venue.update({
      where: { id: existing.id },
      data:  { lat: coords.lat, lng: coords.lng, address: venue.address, kind: venue.type, isPlaceholder: false },
    })
  }

  return prisma.venue.create({
    data: {
      name:    venue.name,
      address: venue.address,
      // No geocode → keep the city centre but flag it, so the map skips it
      // rather than dropping a pin on the Duomo.
      lat:     coords?.lat ?? MILAN_LAT,
      lng:     coords?.lng ?? MILAN_LNG,
      kind: venue.type ?? inferVenueKind(venue.name),
      type: VenueType.OTHER,
      isPlaceholder: !coords,
      cityId,
    }
  })
}

async function upsertEvent(
  scraped: ScrapedEvent,
  city: { id: string; name: string; lat: number; lng: number },
  stats: UpsertStats,
) {
  try {
    if (!scraped.venue) stats.unresolvedVenue++

    const venue = scraped.venue
      ? await getOrCreateVenue(scraped.venue, city.id)
      : await getPlaceholderVenue(city.id, city.name, city.lat, city.lng)

    const format = matchFormat(scraped.title, scraped.description)

    // Everything scraped is a dated run: a permanent collection is not
    // something a listing site advertises with dates, so it is curated in
    // rather than crawled.
    const dates = {
      run:      'TEMPORARY' as const,
      startsOn: toCalendarDay(scraped.startDate),
      endsOn:   scraped.endDate ? toCalendarDay(scraped.endDate) : null,
    }

    // Free and unknown are different facts, so only claim FREE when a source
    // actually said so. `parsePrice` returning undefined means "no number
    // found", which is not evidence of free admission.
    const admission =
      scraped.isFree            ? ('FREE'  as const)
      : scraped.price != null   ? ('PAID'  as const)
      :                           ('UNKNOWN' as const)
    const priceCents = scraped.price != null ? Math.round(scraped.price * 100) : null

    // Identity: the source URL, which is stable. Matching on title + day
    // inserted a duplicate whenever a source reworded a heading.
    const existing = scraped.ticketUrl
      ? await prisma.exhibition.findFirst({ where: { sourceUrl: scraped.ticketUrl } })
        ?? await prisma.exhibition.findFirst({
             where: { title: { equals: scraped.title, mode: 'insensitive' }, startsOn: dates.startsOn },
           })
      : await prisma.exhibition.findFirst({
          where: { title: { equals: scraped.title, mode: 'insensitive' }, startsOn: dates.startsOn },
        })

    const now = new Date()

    if (existing) {
      // Only overwrite a field when this run actually extracted something.
      // Writing `?? null` meant any run where a selector missed erased a
      // price, image or end date an earlier run had captured — so each
      // scheduled scrape could quietly degrade the data.
      await prisma.exhibition.update({
        where: { id: existing.id },
        data: {
          title:      scraped.title,
          format,
          run:        dates.run,
          startsOn:   dates.startsOn,
          lastSeenAt: now,
          ...(dates.endsOn        ? { endsOn:      dates.endsOn      } : {}),
          ...(scraped.description ? { description: scraped.description } : {}),
          ...(scraped.imageUrl    ? { imageUrl:    scraped.imageUrl    } : {}),
          ...(scraped.ticketUrl   ? { ticketUrl:   scraped.ticketUrl, sourceUrl: scraped.ticketUrl } : {}),
          ...(scraped.source      ? { sourceName:  scraped.source      } : {}),
          // Never downgrade a known admission back to UNKNOWN.
          ...(admission !== 'UNKNOWN' ? { admission, priceCents } : {}),
          venueId: venue.id,
        }
      })
      await tagArtForms(existing.id, scraped.title, scraped.description)
      stats.updated++
    } else {
      const created = await prisma.exhibition.create({
        data: {
          title:       scraped.title,
          description: scraped.description,
          format,
          run:         dates.run,
          startsOn:    dates.startsOn,
          endsOn:      dates.endsOn,
          admission,
          priceCents,
          ticketUrl:   scraped.ticketUrl,
          sourceUrl:   scraped.ticketUrl,
          sourceName:  scraped.source,
          imageUrl:    scraped.imageUrl,
          lastSeenAt:  now,
          venueId:     venue.id,
        }
      })
      await tagArtForms(created.id, scraped.title, scraped.description)
      stats.inserted++
    }
  } catch (err) {
    console.warn(`  ⚠ Skipped "${scraped.title}": ${(err as Error).message}`)
    stats.skipped++
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎨 ArtBeat Milan Exhibition Scraper\n')

  // Stamped before any request so `lastSeenAt >= runStartedAt` cleanly
  // separates 'seen this run' from 'not seen'.
  const runStartedAt = new Date()

  const city = await getMilanCity()
  console.log(`✓ City: ${city.name} (${city.id})\n`)

  const browser = await chromium.launch({ headless: true })
  // USER_AGENT was declared but never applied, so the scraper advertised
  // headless Chrome — trivially fingerprinted, and at least one source now
  // rejects it outright. Set it on the context along with the locale.
  const context = await browser.newContext({
    userAgent:  USER_AGENT,
    locale:     'it-IT',
    viewport:   { width: 1440, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': 'it-IT,it;q=0.9' },
  })
  const page = await context.newPage()

  const allScraped: ScrapedEvent[] = []
  const perSource = new Map<string, SourceResult>()

  for (const src of SOURCES) {
    console.log(`🌐 Scraping ${src.label}...`)
    const result = await scrapeGeneric(page, src.url, src.linkRe, src.label, src.venue, src.detail)
    perSource.set(src.label, result)
    allScraped.push(...result.events)
  }

  await browser.close()

  // Same identity rule as the upsert: URL first, title+day as fallback.
  const seen = new Set<string>()
  const uniqueEvents = allScraped.filter(e => {
    const key = e.ticketUrl
      ? `url:${e.ticketUrl}`
      : `t:${e.title.toLowerCase().trim()}|${e.startDate.toISOString().slice(0, 10)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  console.log(`\n📋 Processing ${uniqueEvents.length} unique events...`)

  const stats: UpsertStats = { inserted: 0, updated: 0, skipped: 0, unresolvedVenue: 0 }

  for (const event of uniqueEvents) {
    await upsertEvent(event, city, stats)
  }

  const mappable = uniqueEvents.length - stats.unresolvedVenue
  console.log('\n─────────────────────────────────────────')
  console.log('✅ Scrape complete!')
  console.log(`   Inserted : ${stats.inserted}`)
  console.log(`   Updated  : ${stats.updated}`)
  console.log(`   Skipped  : ${stats.skipped}`)
  console.log(`   Mappable : ${mappable}/${uniqueEvents.length} (venue resolved)`)
  if (stats.unresolvedVenue) {
    console.log(`   ⚠ ${stats.unresolvedVenue} event(s) have no confirmed venue —`)
    console.log(`     listed in Discover, withheld from the map.`)
  }

  // Two distinct failures, two distinct fixes:
  //   no links      → listing didn't render, or the link pattern is stale
  //   links, 0 events → detail pages parsed but yielded nothing usable
  //                     (usually no parseable date, or a rejected title)
  console.log('\n   Per source:            links  events')
  const noLinks: string[] = []
  const noEvents: string[] = []
  for (const [label, { linkCount, events }] of perSource) {
    const ok = events.length > 0
    console.log(`     ${ok ? '✓' : '✗'} ${label.padEnd(18)} ${String(linkCount).padStart(4)}  ${String(events.length).padStart(5)}`)
    if (linkCount === 0) noLinks.push(label)
    else if (events.length === 0) noEvents.push(label)
  }
  if (noLinks.length) {
    console.log(`\n   ⚠ no links matched: ${noLinks.join(', ')}`)
    console.log(`     → listing page did not render, or the link regex is stale.`)
  }
  if (noEvents.length) {
    console.log(`\n   ⚠ links found but no usable events: ${noEvents.join(', ')}`)
    console.log(`     → detail pages reachable; date parsing or title validation`)
    console.log(`       is rejecting everything. Check parseDateRange coverage.`)
  }
  // Written for `db:reconcile`, which must know whether a source was working
  // before it treats a missing exhibition as a takedown.
  const health = [...perSource].map(([label, r]) => ({
    label,
    linkCount: r.linkCount,
    events:    r.events.length,
    // Hitting the per-source cap means we saw a page, not the whole programme.
    // Absence from a truncated listing says nothing about whether a show is
    // still running, so takedown detection must ignore these entirely.
    capped:    r.linkCount >= MAX_PER_SOURCE,
    ranAt:     runStartedAt.toISOString(),
  }))
  const logDir = path.resolve(__dirname, '../logs')
  fs.mkdirSync(logDir, { recursive: true })
  fs.writeFileSync(path.join(logDir, 'last-run-sources.json'), JSON.stringify(health, null, 2))
  console.log(`\n   source health → logs/last-run-sources.json`)
  console.log('─────────────────────────────────────────')
}

main()
  .catch(err => {
    console.error('Fatal error:', err)
    // Exit non-zero: this previously logged and exited 0, so a cron job or CI
    // step would report success even when the scrape never ran at all.
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())