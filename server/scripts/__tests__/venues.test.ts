import { describe, it, expect } from 'vitest'
import {
  resolveVenue,
  matchKnownVenue,
  normalizeForMatch,
  isUsableVenueName,
  inferVenueKind,
} from '../venues'
import { VenueKind } from '@prisma/client'

/**
 * These tests exist because venue resolution was the single worst bug in the
 * project: the old scraper fell back to a venue literally named "Milan", which
 * put 20 of 24 events on one fake pin at the city centre and made the map
 * actively misleading.  Every case below is a regression guard for something
 * that actually went wrong.
 */

describe('isUsableVenueName', () => {
  it('rejects the city name — the original bug', () => {
    expect(isUsableVenueName('Milan')).toBe(false)
    expect(isUsableVenueName('Milano')).toBe(false)
    expect(isUsableVenueName('MILANO')).toBe(false)
  })

  it('rejects empty and whitespace names', () => {
    // A real venue row existed with name '' and rendered a titleless card.
    expect(isUsableVenueName('')).toBe(false)
    expect(isUsableVenueName('   ')).toBe(false)
    expect(isUsableVenueName(undefined)).toBe(false)
    expect(isUsableVenueName(null)).toBe(false)
  })

  it('rejects source names and section labels masquerading as venues', () => {
    expect(isUsableVenueName('Arte.it')).toBe(false)
    expect(isUsableVenueName('mostre')).toBe(false)
    expect(isUsableVenueName('Italy')).toBe(false)
  })

  it('accepts real venue names', () => {
    expect(isUsableVenueName('Palazzo Reale')).toBe(true)
    expect(isUsableVenueName('Fondazione Prada')).toBe(true)
  })
})

describe('normalizeForMatch', () => {
  it('folds typographic apostrophes to ASCII', () => {
    // This is why "Galleria d’Arte Moderna" silently failed to match an alias
    // written with a straight quote — 7 events were stranded by it.
    expect(normalizeForMatch('Galleria d’Arte Moderna'))
      .toBe(normalizeForMatch("Galleria d'Arte Moderna"))
  })

  it('folds accents', () => {
    expect(normalizeForMatch('Galleria Crédit Agricole'))
      .toBe(normalizeForMatch('Galleria Credit Agricole'))
  })

  it('folds en/em dashes and collapses whitespace', () => {
    expect(normalizeForMatch('MUDEC – Museo')).toBe(normalizeForMatch('MUDEC - Museo'))
    expect(normalizeForMatch('a   b\n c')).toBe('a b c')
  })
})

describe('matchKnownVenue', () => {
  it('finds a venue named in an aggregator title', () => {
    const t = 'I Macchiaioli - Mostra - Milano - Palazzo Reale - Arte.it'
    expect(matchKnownVenue(t)?.name).toBe('Palazzo Reale')
  })

  it('matches despite a curly apostrophe in the source text', () => {
    const t = 'Paul Troubetzkoy - Mostra - Milano - GAM | Galleria d’Arte Moderna - Arte.it'
    expect(matchKnownVenue(t)?.name).toContain('GAM')
  })

  it('prefers the more specific alias', () => {
    // "brera" alone must not win over "pinacoteca di brera".
    expect(matchKnownVenue('Mostra alla Pinacoteca di Brera')?.name).toBe('Pinacoteca di Brera')
  })

  it('returns null when no known venue is mentioned', () => {
    expect(matchKnownVenue('Mostra - Milano - Qualche Posto Sconosciuto')).toBeNull()
  })

  it('searches across all supplied fields', () => {
    expect(matchKnownVenue('Untitled show', 'Held at Fondazione Prada.')?.name)
      .toBe('Fondazione Prada')
  })
})

describe('inferVenueKind', () => {
  it('classifies by keyword', () => {
    expect(inferVenueKind('Museo del Novecento')).toBe(VenueKind.MUSEUM)
    expect(inferVenueKind('Pinacoteca di Brera')).toBe(VenueKind.MUSEUM)
    expect(inferVenueKind('Galleria Continua')).toBe(VenueKind.GALLERY)
    expect(inferVenueKind('Teatro alla Scala')).toBe(VenueKind.THEATER)
  })

  it('falls back to OTHER when the name gives nothing away', () => {
    // "Palazzo Reale" is a museum but the name says so nowhere — which is why
    // the curated list must take precedence over inference.
    expect(inferVenueKind('Palazzo Reale')).toBe(VenueKind.OTHER)
  })
})

describe('resolveVenue', () => {
  it('prefers structured JSON-LD location', () => {
    const r = resolveVenue({
      jsonLdLocation: { name: 'Triennale Milano' },
      title: 'Something at Palazzo Reale',
    })
    expect(r?.name).toBe('Triennale Milano')
  })

  it('ignores a JSON-LD location that is just the city', () => {
    // The exact shape that produced the fake "Milan" venue.
    const r = resolveVenue({
      jsonLdLocation: { name: 'Milano' },
      title: 'Mostra - Milano - MUDEC - Arte.it',
    })
    expect(r?.name).toContain('MUDEC')
  })

  it('uses the single-venue source when structured data is absent', () => {
    const sourceVenue = { name: 'MUDEC – Museo delle Culture', address: 'Via Tortona 56', type: VenueKind.MUSEUM }
    expect(resolveVenue({ sourceVenue, title: 'Untitled' })?.name).toBe('MUDEC – Museo delle Culture')
  })

  it('falls back to a known venue named in the page text', () => {
    const r = resolveVenue({ title: 'Show', pageText: 'Presso Villa Necchi Campiglio, Milano.' })
    expect(r?.name).toBe('Villa Necchi Campiglio')
  })

  it('returns null rather than inventing a location — the core contract', () => {
    // Failing closed is the whole point: a pin in the wrong place is worse
    // than no pin.
    expect(resolveVenue({ title: 'Mostra a Milano', description: 'Un evento.' })).toBeNull()
    expect(resolveVenue({})).toBeNull()
    expect(resolveVenue({ jsonLdLocation: { name: 'Milan' } })).toBeNull()
  })

  it('builds an address from a structured JSON-LD address object', () => {
    const r = resolveVenue({
      jsonLdLocation: {
        name: 'Spazio Sconosciuto',
        address: { streetAddress: 'Via Test 1', postalCode: '20100', addressLocality: 'Milano' },
      },
    })
    expect(r?.address).toBe('Via Test 1, 20100, Milano')
  })
})
