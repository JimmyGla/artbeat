import { describe, it, expect } from 'vitest'
import { townOf, venueGeocodeQueries, inTown } from '../geocode'

// Cases are the venues that failed to geocode on 2026-11-27, plus the wrong
// hit ("Via Manzoni 45, Milano" → Vignate) that the town check exists to stop.

describe('townOf', () => {
  it('reads the town at the end of an address', () => {
    expect(townOf('Via Giovanni Frova 10, Cinisello Balsamo')).toBe('Cinisello Balsamo')
    expect(townOf('Via Vittorio Emanuele II, 53, Vimercate')).toBe('Vimercate')
    expect(townOf('Piazza del Duomo 12, 20122 Milano')).toBe('Milano')
  })

  it('returns undefined when the address names no town', () => {
    expect(townOf('Via Palestro 14')).toBeUndefined()
    expect(townOf('Via Vittorio Emanuele II, 53')).toBeUndefined()
  })
})

describe('venueGeocodeQueries', () => {
  it('does not append Milan to an address in another town', () => {
    const [first] = venueGeocodeQueries({ name: 'MUST Museo del territorio', address: 'Via Vittorio Emanuele II, 53, Vimercate' })
    expect(first).toEqual({ query: 'Via Vittorio Emanuele II, 53, Vimercate, Italy', town: 'Vimercate' })
  })

  it('falls back to the venue name when the address will not parse', () => {
    expect(venueGeocodeQueries({ name: 'Bottegantica', address: 'Via A. Manzoni 45, Milano' }).map((q) => q.query))
      .toEqual(['Via A. Manzoni 45, Milano, Italy', 'Bottegantica, Milano'])
  })

  it('tries the first of two joined names', () => {
    const queries = venueGeocodeQueries({
      name: 'Acquario Civico I Museo di Storia Naturale',
      address: 'Acquario Civico I Museo di Storia Naturale, Milano',
    }).map((q) => q.query)
    expect(queries).toContain('Acquario Civico, Milano')
  })

  it('defaults to Milano when the address has no town', () => {
    expect(venueGeocodeQueries({ name: 'Galleria X', address: 'Via Palestro 14' })[0])
      .toEqual({ query: 'Via Palestro 14, Milano, Italy', town: 'Milano' })
  })
})

describe('inTown', () => {
  it('rejects a hit in the wrong town', () => {
    expect(inTown({ village: 'Vignate', city: 'Vignate', county: 'Milano' }, 'Milano')).toBe(false)
  })

  it('accepts the right town, whatever field Nominatim uses', () => {
    expect(inTown({ city: 'Milano' }, 'Milan')).toBe(true)
    expect(inTown({ village: 'San Maurizio', town: 'Vimercate' }, 'Vimercate')).toBe(true)
    expect(inTown({ town: 'Cinisello Balsamo' }, 'cinisello balsamo')).toBe(true)
  })

  it('rejects a hit with no address details', () => {
    expect(inTown(undefined, 'Milano')).toBe(false)
  })
})
