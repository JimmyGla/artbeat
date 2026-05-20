/**
 * ArtBeat — Milan Art Events Scraper
 *
 * Sources attempted (skipped gracefully on error):
 *   1. eventbrite.com  – "art milan"
 *   2. meetup.com      – "arte milano"
 *   3. yesmilano.it    – art & exhibitions section
 *   4. vivimilano.corriere.it – mostre (exhibitions)
 *
 * Strategy:
 *   Phase 1 – collect event detail-page URLs from each listing page
 *   Phase 2 – visit every detail page and extract:
 *     • dates  → JSON-LD <script type="application/ld+json">   (most reliable)
 *     • image  → <meta property="og:image">                    (always absolute, always loaded)
 *     • description / price / venue → JSON-LD + OG meta + DOM
 *
 * Prerequisites (run once):
 *   npm install playwright
 *   npx playwright install chromium
 *
 * Usage:
 *   npm run scrape
 */

import { chromium, Page } from 'playwright';
import { PrismaClient, VenueType } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const DELAY_MS      = 1500;
const MAX_PER_SOURCE = 10;   // detail pages to visit per source
const MILAN_LAT     = 45.4654;
const MILAN_LNG     = 9.1859;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScrapedVenue {
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  website?: string;
  type?: VenueType;
}

interface ScrapedEvent {
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  price?: number;
  ticketUrl?: string;
  imageUrl?: string;
  venue: ScrapedVenue;
  source: string;
}

interface UpsertStats {
  inserted: number;
  updated: number;
  skipped: number;
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocode(address: string): Promise<{ lat: number; lng: number }> {
  try {
    const query = encodeURIComponent(`${address}, Milan, Italy`);
    const url   = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
    const res   = await fetch(url, {
      headers: {
        'User-Agent': 'ArtBeat-Scraper/1.0 (contact@artbeat.app)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) throw new Error('no results');
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return { lat: MILAN_LAT, lng: MILAN_LNG };
  }
}

function parsePrice(raw: string): number | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase().trim();
  if (['free', 'gratuito', 'ingresso libero', 'gratis', ''].includes(lower)) return undefined;
  const match = raw.match(/[\d]+[.,]?[\d]*/);
  if (!match) return undefined;
  const val = parseFloat(match[0].replace(',', '.'));
  return isNaN(val) || val === 0 ? undefined : val;
}

const ITALIAN_MONTHS: Record<string, string> = {
  gennaio: 'January',  febbraio: 'February', marzo: 'March',
  aprile: 'April',     maggio: 'May',         giugno: 'June',
  luglio: 'July',      agosto: 'August',      settembre: 'September',
  ottobre: 'October',  novembre: 'November',  dicembre: 'December',
};

function parseDate(raw: string | undefined | null): Date | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  // ISO / RFC 2822 — fastest path
  let d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d;

  // Translate Italian month names
  let normalised = trimmed.toLowerCase();
  for (const [it, en] of Object.entries(ITALIAN_MONTHS)) {
    normalised = normalised.replace(new RegExp(it, 'gi'), en);
  }
  d = new Date(normalised);
  if (!isNaN(d.getTime())) return d;

  return undefined;
}

// ─── Page-level extractors ────────────────────────────────────────────────────

/** Pull the first Event-type object out of any JSON-LD blocks on the page. */
async function extractJsonLd(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const EVENT_TYPES = new Set([
      'Event', 'ExhibitionEvent', 'VisualArtsEvent', 'MusicEvent',
      'TheaterEvent', 'SaleEvent', 'Festival',
    ]);
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const raw  = JSON.parse(script.textContent ?? '');
        const items: unknown[] = Array.isArray(raw) ? raw : [raw];
        for (const item of items) {
          if (
            item !== null &&
            typeof item === 'object' &&
            EVENT_TYPES.has((item as Record<string, unknown>)['@type'] as string)
          ) {
            return item as Record<string, unknown>;
          }
        }
      } catch { /* malformed JSON — skip */ }
    }
    return null;
  });
}

/** Extract common OG / meta tags in a single page.evaluate call. */
async function extractMeta(page: Page): Promise<{
  ogImage: string;
  ogTitle: string;
  ogDescription: string;
  publishedTime: string;
}> {
  return page.evaluate(() => {
    const get = (sel: string, attr = 'content') =>
      (document.querySelector(sel) as HTMLMetaElement | null)?.[attr as keyof HTMLMetaElement] as string ?? '';

    return {
      ogImage:       get('meta[property="og:image"]'),
      ogTitle:       get('meta[property="og:title"]'),
      ogDescription: get('meta[property="og:description"]'),
      publishedTime: get('meta[property="article:published_time"]') ||
                     get('meta[name="date"]') ||
                     get('meta[name="publish_date"]'),
    };
  });
}

// ─── Category matching ────────────────────────────────────────────────────────

const CATEGORY_RULES: Array<{ slug: string; keywords: string[] }> = [
  {
    slug: 'opening',
    keywords: ['opening', 'vernissage', 'inaugurazione', 'apertura', 'finissage'],
  },
  {
    slug: 'performance',
    keywords: [
      'performance', 'spettacolo', 'teatro', 'theater', 'theatre',
      'concerto', 'concert', 'musica', 'music', 'danza', 'dance',
      'festival', 'live', 'corpo', 'sonoro',
    ],
  },
  {
    slug: 'exhibition',
    keywords: [
      'mostra', 'esposizione', 'exhibition', 'galleria', 'gallery',
      'arte', 'pittura', 'scultura', 'fotografia', 'photo', 'design',
      'archivio', 'installazione', 'installation', 'workshop',
    ],
  },
];

function matchCategorySlug(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  for (const { slug, keywords } of CATEGORY_RULES) {
    if (keywords.some((kw) => text.includes(kw))) return slug;
  }
  return 'exhibition';
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getMilanCity() {
  const city = await prisma.city.findUnique({ where: { slug: 'milan' } });
  if (city) return city;
  console.warn('  ⚠ Milan city not found — creating it (run npm run prisma:seed for full seed)');
  return prisma.city.create({
    data: { name: 'Milan', slug: 'milan', country: 'Italy', lat: MILAN_LAT, lng: MILAN_LNG, isActive: true },
  });
}

async function getOrCreateCategory(slug: string) {
  const found = await prisma.category.findUnique({ where: { slug } });
  if (found) return found;
  const any = await prisma.category.findFirst();
  if (any) return any;
  return prisma.category.create({ data: { name: 'Exhibition', slug: 'exhibition', color: '#7C3AED' } });
}

async function getOrCreateVenue(venue: ScrapedVenue, cityId: string): Promise<{ id: string }> {
  const existing = await prisma.venue.findFirst({
    where: { name: { equals: venue.name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return existing;

  let lat = venue.lat ?? 0;
  let lng = venue.lng ?? 0;
  if (!venue.lat || !venue.lng) {
    const coords = await geocode(venue.address);
    lat = coords.lat;
    lng = coords.lng;
    await sleep(1200); // Nominatim: 1 req/s
  }

  return prisma.venue.create({
    data: {
      name:    venue.name,
      address: venue.address || 'Milan, Italy',
      lat,
      lng,
      type:    venue.type ?? VenueType.OTHER,
      website: venue.website ?? null,
      cityId,
    },
    select: { id: true },
  });
}

async function upsertEvent(scraped: ScrapedEvent, cityId: string, stats: UpsertStats): Promise<void> {
  try {
    const categorySlug = matchCategorySlug(scraped.title, scraped.description);
    const [category, venue] = await Promise.all([
      getOrCreateCategory(categorySlug),
      getOrCreateVenue(scraped.venue, cityId),
    ]);

    const dayStart = new Date(scraped.startDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(scraped.startDate);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await prisma.event.findFirst({
      where: {
        title:     { equals: scraped.title, mode: 'insensitive' },
        startDate: { gte: dayStart, lte: dayEnd },
      },
      select: { id: true, imageUrl: true },
    });

    if (existing) {
      await prisma.event.update({
        where: { id: existing.id },
        data: {
          description: scraped.description,
          endDate:     scraped.endDate ?? null,
          price:       scraped.price ?? null,
          ticketUrl:   scraped.ticketUrl ?? null,
          imageUrl:    scraped.imageUrl ?? existing.imageUrl ?? null,
          categoryId:  category.id,
          venueId:     venue.id,
        },
      });
      stats.updated++;
    } else {
      await prisma.event.create({
        data: {
          title:       scraped.title,
          description: scraped.description || scraped.title,
          startDate:   scraped.startDate,
          endDate:     scraped.endDate ?? null,
          price:       scraped.price ?? null,
          ticketUrl:   scraped.ticketUrl ?? null,
          imageUrl:    scraped.imageUrl ?? null,
          categoryId:  category.id,
          venueId:     venue.id,
        },
      });
      stats.inserted++;
    }
  } catch (err) {
    console.warn(`  ⚠ Skipped "${scraped.title}": ${(err as Error).message}`);
    stats.skipped++;
  }
}

// ─── Generic detail-page scraper ──────────────────────────────────────────────

/**
 * Visit a single event detail page and return a ScrapedEvent.
 * Relies primarily on JSON-LD for dates, og:image for the image.
 */
async function scrapeDetailPage(
  page: Page,
  detailUrl: string,
  source: string,
  fallbackTitle?: string,
): Promise<ScrapedEvent | null> {
  try {
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await sleep(800);

    const [jsonLd, meta] = await Promise.all([
      extractJsonLd(page),
      extractMeta(page),
    ]);

    // ── Title ────────────────────────────────────────────────────────────────
    const title =
      (jsonLd?.['name'] as string | undefined) ||
      meta.ogTitle ||
      fallbackTitle ||
      (await page.$eval('h1', (el) => el.textContent?.trim() ?? '').catch(() => ''));

    if (!title) return null;

    // ── Description ──────────────────────────────────────────────────────────
    const description =
      (jsonLd?.['description'] as string | undefined) ||
      meta.ogDescription ||
      (await page.$eval(
        '[class*="description"], [class*="about"], [itemprop="description"], p',
        (el) => el.textContent?.trim() ?? '',
      ).catch(() => '')) ||
      title;

    // ── Dates ────────────────────────────────────────────────────────────────
    // JSON-LD is the gold standard; fall back to OG/meta, then DOM time elements
    const startDate =
      parseDate(jsonLd?.['startDate'] as string | undefined) ||
      parseDate(meta.publishedTime) ||
      (await page
        .$eval('time[datetime]', (el) => el.getAttribute('datetime') ?? '')
        .then((v) => parseDate(v))
        .catch(() => undefined));

    if (!startDate) {
      console.warn(`  ⚠ No date found for "${title}" (${detailUrl}) — skipping`);
      return null;
    }

    const endDate =
      parseDate(jsonLd?.['endDate'] as string | undefined) ||
      (await page
        .$eval('time[datetime]:last-of-type', (el) => el.getAttribute('datetime') ?? '')
        .then((v) => {
          const d = parseDate(v);
          return d && d > startDate ? d : undefined;
        })
        .catch(() => undefined));

    // ── Image — og:image is always absolute and fully loaded ─────────────────
    const imageUrl =
      (meta.ogImage && meta.ogImage.startsWith('http') ? meta.ogImage : undefined) ||
      (() => {
        const raw = jsonLd?.['image'];
        if (typeof raw === 'string' && raw.startsWith('http')) return raw;
        if (raw && typeof raw === 'object') {
          const urlField = (raw as Record<string, unknown>)['url'];
          if (typeof urlField === 'string' && urlField.startsWith('http')) return urlField;
        }
        return undefined;
      })();

    // ── Price ────────────────────────────────────────────────────────────────
    const offerRaw = jsonLd?.['offers'];
    let price: number | undefined;
    if (offerRaw && typeof offerRaw === 'object') {
      const offer = Array.isArray(offerRaw) ? offerRaw[0] : offerRaw;
      const offerPrice = (offer as Record<string, unknown>)?.['price'];
      if (offerPrice !== undefined && offerPrice !== null) {
        price = parsePrice(String(offerPrice));
      }
    }
    if (price === undefined) {
      const priceText = await page
        .$eval('[class*="price"], [class*="ticket"], [data-testid*="price"]', (el) => el.textContent ?? '')
        .catch(() => '');
      price = parsePrice(priceText);
    }

    // ── Venue ────────────────────────────────────────────────────────────────
    let venueName    = 'Milan Venue';
    let venueAddress = 'Milan, Italy';
    let venueLat: number | undefined;
    let venueLng: number | undefined;

    const locationRaw = jsonLd?.['location'];
    if (locationRaw && typeof locationRaw === 'object') {
      const loc = locationRaw as Record<string, unknown>;
      venueName    = (loc['name'] as string | undefined) || venueName;
      const addr   = loc['address'];
      if (typeof addr === 'string') {
        venueAddress = addr;
      } else if (addr && typeof addr === 'object') {
        const a = addr as Record<string, unknown>;
        const parts = [a['streetAddress'], a['addressLocality'], a['addressCountry']]
          .filter(Boolean)
          .join(', ');
        if (parts) venueAddress = parts;
      }
      const geo = loc['geo'] as Record<string, unknown> | undefined;
      if (geo) {
        venueLat = typeof geo['latitude']  === 'number' ? geo['latitude']  : undefined;
        venueLng = typeof geo['longitude'] === 'number' ? geo['longitude'] : undefined;
      }
    }

    // If still generic, try DOM
    if (venueName === 'Milan Venue') {
      venueName = await page
        .$eval(
          '[class*="venue"], [itemprop="location"], [class*="location"]',
          (el) => el.textContent?.trim().split('\n')[0].trim() ?? '',
        )
        .catch(() => 'Milan Venue');
    }

    return {
      title,
      description,
      startDate,
      endDate,
      price,
      ticketUrl: detailUrl,
      imageUrl,
      venue: {
        name:    venueName    || 'Milan Venue',
        address: venueAddress || 'Milan, Italy',
        lat:     venueLat,
        lng:     venueLng,
      },
      source,
    };
  } catch (err) {
    console.warn(`  ⚠ Failed to scrape detail page ${detailUrl}: ${(err as Error).message}`);
    return null;
  }
}

// ─── Source listing-page scrapers ─────────────────────────────────────────────
// Each function collects detail-page URLs from a listing page, then visits them.

async function scrapeEventbrite(page: Page): Promise<ScrapedEvent[]> {
  const results: ScrapedEvent[] = [];
  try {
    await page.goto('https://www.eventbrite.com/d/italy--milan/art--events/', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await sleep(DELAY_MS);
    await page.waitForSelector('a[href*="/e/"]', { timeout: 15_000 }).catch(() => {});

    // Collect unique event detail links
    const links = await page.evaluate((limit) => {
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/e/"]'));
      const seen = new Set<string>();
      return anchors
        .map((a) => a.href)
        .filter((href) => {
          const clean = href.split('?')[0];
          if (seen.has(clean)) return false;
          seen.add(clean);
          return /eventbrite\.com\/e\//.test(clean);
        })
        .slice(0, limit);
    }, MAX_PER_SOURCE);

    console.log(`  Eventbrite listing: ${links.length} detail link(s) found`);

    for (const link of links) {
      await sleep(DELAY_MS);
      const event = await scrapeDetailPage(page, link, 'eventbrite');
      if (event) {
        results.push(event);
        console.log(`    ✓ ${event.title}`);
      }
    }
  } catch (err) {
    console.warn(`  Eventbrite: skipped — ${(err as Error).message}`);
  }
  return results;
}

async function scrapeMeetup(page: Page): Promise<ScrapedEvent[]> {
  const results: ScrapedEvent[] = [];
  try {
    await page.goto(
      'https://www.meetup.com/find/?keywords=arte+milano&location=Milano%2C+IT&source=EVENTS',
      { waitUntil: 'domcontentloaded', timeout: 30_000 },
    );
    await sleep(DELAY_MS * 2);
    await page.waitForSelector('a[href*="/events/"]', { timeout: 15_000 }).catch(() => {});

    const links = await page.evaluate((limit) => {
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/events/"]'));
      const seen = new Set<string>();
      return anchors
        .map((a) => a.href)
        .filter((href) => {
          const clean = href.split('?')[0];
          if (seen.has(clean)) return false;
          seen.add(clean);
          return /meetup\.com\/.+\/events\/\d+/.test(clean);
        })
        .slice(0, limit);
    }, MAX_PER_SOURCE);

    console.log(`  Meetup listing: ${links.length} detail link(s) found`);

    for (const link of links) {
      await sleep(DELAY_MS);
      const event = await scrapeDetailPage(page, link, 'meetup');
      if (event) {
        results.push(event);
        console.log(`    ✓ ${event.title}`);
      }
    }
  } catch (err) {
    console.warn(`  Meetup: skipped — ${(err as Error).message}`);
  }
  return results;
}

async function scrapeYesMilano(page: Page): Promise<ScrapedEvent[]> {
  const results: ScrapedEvent[] = [];
  try {
    await page.goto('https://www.yesmilano.it/en/what-to-do/art-exhibitions', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await sleep(DELAY_MS);
    await page
      .waitForSelector('a[href*="/en/"]', { timeout: 15_000 })
      .catch(() => {});

    const links = await page.evaluate((limit) => {
      const base = 'https://www.yesmilano.it';
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
      const seen = new Set<string>();
      return anchors
        .map((a) => {
          const href = a.getAttribute('href') ?? '';
          return href.startsWith('http') ? href : base + href;
        })
        .filter((href) => {
          if (!href.includes('yesmilano.it/en/') || href === 'https://www.yesmilano.it/en/what-to-do/art-exhibitions') return false;
          // Must look like an event/article page, not a category
          if (!/\/en\/(what-to-do|eventi|events|mostre|exhibitions?)\/[^/]+\/[^/]+/.test(href) &&
              !/\/en\/[^/]+\/[^/]+\/[^/]+/.test(href)) return false;
          const clean = href.split('?')[0];
          if (seen.has(clean)) return false;
          seen.add(clean);
          return true;
        })
        .slice(0, limit);
    }, MAX_PER_SOURCE);

    console.log(`  YesMilano listing: ${links.length} detail link(s) found`);

    for (const link of links) {
      await sleep(DELAY_MS);
      const event = await scrapeDetailPage(page, link, 'yesmilano');
      if (event) {
        results.push(event);
        console.log(`    ✓ ${event.title}`);
      }
    }
  } catch (err) {
    console.warn(`  YesMilano: skipped — ${(err as Error).message}`);
  }
  return results;
}

async function scrapeViviMilano(page: Page): Promise<ScrapedEvent[]> {
  const results: ScrapedEvent[] = [];
  try {
    await page.goto('https://vivimilano.corriere.it/mostre', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await sleep(DELAY_MS);
    await page
      .waitForSelector('a[href*="vivimilano"]', { timeout: 15_000 })
      .catch(() => {});

    const links = await page.evaluate((limit) => {
      const base = 'https://vivimilano.corriere.it';
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
      const seen = new Set<string>();
      return anchors
        .map((a) => {
          const href = a.getAttribute('href') ?? '';
          if (href.startsWith('http')) return href;
          if (href.startsWith('/')) return base + href;
          return '';
        })
        .filter((href) => {
          if (!href.includes('vivimilano.corriere.it/') || href === 'https://vivimilano.corriere.it/mostre') return false;
          // Looks like an article: has a date-like path or a slug after /mostre/
          if (!/\/mostre\/[^/]+/.test(href) && !/\d{4}\/\d{2}\/\d{2}/.test(href)) return false;
          const clean = href.split('?')[0].split('#')[0];
          if (seen.has(clean)) return false;
          seen.add(clean);
          return true;
        })
        .slice(0, limit);
    }, MAX_PER_SOURCE);

    console.log(`  ViviMilano listing: ${links.length} detail link(s) found`);

    for (const link of links) {
      await sleep(DELAY_MS);
      const event = await scrapeDetailPage(page, link, 'vivimilano');
      if (event) {
        results.push(event);
        console.log(`    ✓ ${event.title}`);
      }
    }
  } catch (err) {
    console.warn(`  ViviMilano: skipped — ${(err as Error).message}`);
  }
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎨 ArtBeat Milan Event Scraper\n');

  const city = await getMilanCity();
  console.log(`✓ City resolved: ${city.name} (${city.id})\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: 'it-IT',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { 'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7' },
  });

  const page = await context.newPage();
  const allScraped: ScrapedEvent[] = [];

  const sources: Array<[string, (p: Page) => Promise<ScrapedEvent[]>]> = [
    ['Eventbrite', scrapeEventbrite],
    ['Meetup',     scrapeMeetup],
    ['YesMilano',  scrapeYesMilano],
    ['ViviMilano', scrapeViviMilano],
  ];

  for (const [label, scraper] of sources) {
    console.log(`🌐 Scraping ${label}…`);
    const found = await scraper(page);
    allScraped.push(...found);
    console.log(`  → ${found.length} event(s) scraped\n`);
    await sleep(DELAY_MS);
  }

  await browser.close();

  // ── Deduplicate within batch ───────────────────────────────────────────────
  const seen = new Set<string>();
  const uniqueEvents = allScraped.filter((e) => {
    const key = `${e.title.toLowerCase().trim()}|${e.startDate.toISOString().slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(
    `📋 ${uniqueEvents.length} unique event(s) to process ` +
    `(${allScraped.length - uniqueEvents.length} in-batch duplicate(s) removed)\n`,
  );

  // ── Upsert into DB ────────────────────────────────────────────────────────
  const stats: UpsertStats = { inserted: 0, updated: 0, skipped: 0 };
  for (const event of uniqueEvents) {
    await upsertEvent(event, city.id, stats);
    await sleep(300);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────');
  console.log('✅ Scrape complete!');
  console.log(`   Inserted : ${stats.inserted}`);
  console.log(`   Updated  : ${stats.updated}`);
  console.log(`   Skipped  : ${stats.skipped}`);
  console.log('─────────────────────────────────────────');
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
