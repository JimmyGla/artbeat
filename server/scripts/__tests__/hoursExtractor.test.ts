import { describe, it, expect } from 'vitest'
import {
  parseDayOfWeek, expandDayRange, parseOpeningHoursString, parseHoursSpecification,
  extractHoursFromJsonLd, dedupeRanges, pageMatchesVenue,
} from '../hoursExtractor'

/**
 * The extractor's job is to read published hours and, when it cannot, to
 * produce nothing. Both halves are tested: silently inventing a range is worse
 * than an empty result, because the venue page would then display a confident
 * wrong answer.
 */

describe('parseDayOfWeek', () => {
  it('accepts names, schema.org URLs, and abbreviations', () => {
    expect(parseDayOfWeek('Tuesday')).toBe(2)
    expect(parseDayOfWeek('https://schema.org/Sunday')).toBe(0)
    expect(parseDayOfWeek('  MONDAY ')).toBe(1)
    expect(parseDayOfWeek('Sa')).toBe(6)
  })

  it('returns null for anything else', () => {
    // Italian day names are not in the schema.org vocabulary; guessing at them
    // would be inventing data.
    expect(parseDayOfWeek('Martedì')).toBeNull()
    expect(parseDayOfWeek('')).toBeNull()
  })
})

describe('expandDayRange', () => {
  it('expands a range that wraps past Sunday', () => {
    expect(expandDayRange('Tu-Su')).toEqual([2, 3, 4, 5, 6, 0])
  })

  it('handles a single day', () => {
    expect(expandDayRange('Mo')).toEqual([1])
  })

  it('yields nothing for an unparseable spec', () => {
    expect(expandDayRange('Weekends')).toEqual([])
  })
})

describe('parseOpeningHoursString', () => {
  it('parses the standard compact form', () => {
    const r = parseOpeningHoursString('Tu-Su 10:00-19:30')
    expect(r).toHaveLength(6)
    expect(r[0]).toEqual({ weekday: 2, opensAt: 600, closesAt: 1170 })
  })

  it('parses a comma-separated day list', () => {
    const r = parseOpeningHoursString('Mo,We,Fr 09:00-13:00')
    expect(r.map((x) => x.weekday).sort()).toEqual([1, 3, 5])
  })

  it('ignores a range that ends before it starts', () => {
    // Would otherwise read as open all day under a naive comparison.
    expect(parseOpeningHoursString('Mo 19:00-10:00')).toEqual([])
  })

  it('ignores prose and "closed" lines', () => {
    expect(parseOpeningHoursString('Mo closed')).toEqual([])
    expect(parseOpeningHoursString('Aperto tutti i giorni')).toEqual([])
    expect(parseOpeningHoursString('')).toEqual([])
  })
})

describe('parseHoursSpecification', () => {
  it('reads a normal specification', () => {
    const r = parseHoursSpecification({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Tuesday', 'Wednesday'],
      opens: '10:00',
      closes: '19:30',
    })
    expect(r).toEqual([
      { weekday: 2, opensAt: 600, closesAt: 1170 },
      { weekday: 3, opensAt: 600, closesAt: 1170 },
    ])
  })

  it('accepts a single dayOfWeek not wrapped in an array', () => {
    expect(parseHoursSpecification({ dayOfWeek: 'Friday', opens: '09:00', closes: '18:00' }))
      .toEqual([{ weekday: 5, opensAt: 540, closesAt: 1080 }])
  })

  it('drops specifications missing or malforming times', () => {
    expect(parseHoursSpecification({ dayOfWeek: 'Friday' })).toEqual([])
    expect(parseHoursSpecification({ dayOfWeek: 'Friday', opens: 'ore 9', closes: '18:00' })).toEqual([])
    expect(parseHoursSpecification(null)).toEqual([])
  })

  it('drops a specification with no recognisable day', () => {
    // Times without a day cannot be placed, so they must not be stored against
    // an arbitrary one.
    expect(parseHoursSpecification({ dayOfWeek: 'Martedì', opens: '10:00', closes: '19:00' })).toEqual([])
  })
})

describe('extractHoursFromJsonLd', () => {
  it('finds hours nested inside an @graph', () => {
    const block = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'Some site' },
        {
          '@type': 'Museum',
          name: 'Triennale Milano',
          openingHoursSpecification: [
            { dayOfWeek: ['Tuesday', 'Wednesday'], opens: '11:00', closes: '20:00' },
          ],
        },
      ],
    })
    expect(extractHoursFromJsonLd([block])).toEqual([
      { weekday: 2, opensAt: 660, closesAt: 1200 },
      { weekday: 3, opensAt: 660, closesAt: 1200 },
    ])
  })

  it('survives a malformed block alongside a good one', () => {
    const good = JSON.stringify({ openingHours: ['Mo 10:00-18:00'] })
    expect(extractHoursFromJsonLd(['{ not json', good])).toHaveLength(1)
  })

  it('returns nothing when the page declares no hours', () => {
    // The common case for Italian museum sites, and it must stay empty rather
        // than defaulting to anything.
    expect(extractHoursFromJsonLd([JSON.stringify({ '@type': 'Museum', name: 'X' })])).toEqual([])
    expect(extractHoursFromJsonLd([])).toEqual([])
  })

  it('does not double-count a venue publishing both markup shapes', () => {
    const block = JSON.stringify({
      openingHours: ['Tu 10:00-19:30'],
      openingHoursSpecification: [{ dayOfWeek: 'Tuesday', opens: '10:00', closes: '19:30' }],
    })
    expect(extractHoursFromJsonLd([block])).toEqual([{ weekday: 2, opensAt: 600, closesAt: 1170 }])
  })
})

describe('dedupeRanges', () => {
  it('merges touching ranges into continuous opening', () => {
    expect(dedupeRanges([
      { weekday: 2, opensAt: 600, closesAt: 780 },
      { weekday: 2, opensAt: 780, closesAt: 1140 },
    ])).toEqual([{ weekday: 2, opensAt: 600, closesAt: 1140 }])
  })

  it('keeps a genuine lunch closure separate', () => {
    // The distinction that matters: a real gap must survive deduplication or
    // the venue reads as open through lunch.
    expect(dedupeRanges([
      { weekday: 2, opensAt: 600, closesAt: 780 },
      { weekday: 2, opensAt: 900, closesAt: 1140 },
    ])).toHaveLength(2)
  })

  it('does not merge across weekdays', () => {
    expect(dedupeRanges([
      { weekday: 2, opensAt: 600, closesAt: 1170 },
      { weekday: 3, opensAt: 600, closesAt: 1170 },
    ])).toHaveLength(2)
  })
})

describe('pageMatchesVenue', () => {
  it('accepts a page naming the venue', () => {
    expect(pageMatchesVenue('Pinacoteca di Brera', 'Benvenuti alla Pinacoteca di Brera')).toBe(true)
  })

  it('rejects an unrelated page', () => {
    // Guards the real hazard: a redirect to a portal attaching some other
    // institution's hours to this venue.
    expect(pageMatchesVenue('Pinacoteca di Brera', 'Domain for sale — inquire within')).toBe(false)
  })

  it('is not fooled by generic words alone', () => {
    expect(pageMatchesVenue('Pinacoteca di Brera', 'Musei e gallerie d\'arte a Milano')).toBe(false)
  })

  it('treats an uncommon word in an otherwise generic name as distinctive', () => {
    // "Museo del Novecento" is mostly generic, but "novecento" is not — so this
    // page can be confirmed.
    expect(pageMatchesVenue('Museo del Novecento', 'Museo del Novecento — Milano')).toBe(true)
  })

  it('fails closed when the name has nothing distinctive at all', () => {
    // Every word is vocabulary shared by half the institutions in the city, so
    // no page can be confirmed and hours must not be attached from any of them.
    expect(pageMatchesVenue("Museo d'Arte", "Museo d'Arte")).toBe(false)
    expect(pageMatchesVenue('Galleria Milano', 'Galleria Milano')).toBe(false)
  })
})
