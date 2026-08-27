import { describe, it, expect } from 'vitest'
import { parseDate, parseDateRange } from '../dateParser'

/**
 * Dates decide whether an event is shown at all: the `stillOn` filter hides
 * anything already ended, and an event with no parseable start date is
 * discarded outright.  A silent regression here empties the app.
 */

const iso = (d: Date | undefined) => d?.toISOString().slice(0, 10)

describe('parseDate', () => {
  it('parses ISO 8601 (the JSON-LD path)', () => {
    expect(iso(parseDate('2026-04-09'))).toBe('2026-04-09')
  })

  it('reads DD/MM/YYYY as Italian, not American', () => {
    // JS would parse "03/02/2026" as 2 March; in Italy it is 3 February.
    expect(iso(parseDate('03/02/2026'))).toBe('2026-02-03')
    expect(iso(parseDate('25-12-2026'))).toBe('2026-12-25')
  })

  it('parses Italian month names, full and abbreviated', () => {
    expect(iso(parseDate('10 marzo 2026'))).toBe('2026-03-10')
    expect(iso(parseDate('10 mar 2026'))).toBe('2026-03-10')
    expect(iso(parseDate('1 dicembre 2026'))).toBe('2026-12-01')
  })

  it('pins a month-only value to the first of the month', () => {
    expect(iso(parseDate('marzo 2026'))).toBe('2026-03-01')
  })

  it('returns undefined rather than Invalid Date', () => {
    expect(parseDate('')).toBeUndefined()
    expect(parseDate(null)).toBeUndefined()
    expect(parseDate('non è una data')).toBeUndefined()
    expect(parseDate('32 marzo 2026')).toBeUndefined()
    expect(parseDate('10 notamonth 2026')).toBeUndefined()
  })
})

describe('parseDateRange', () => {
  it('parses the Italian "dal … al …" form', () => {
    const r = parseDateRange('dal 10 marzo al 15 giugno 2026')
    expect(iso(r?.start)).toBe('2026-03-10')
    expect(iso(r?.end)).toBe('2026-06-15')
  })

  it('carries the year across when only the end date states it', () => {
    const r = parseDateRange('dal 20 dicembre al 10 gennaio 2027')
    expect(iso(r?.end)).toBe('2027-01-10')
  })

  it('parses an en-dash range across months', () => {
    const r = parseDateRange('10 marzo – 15 giugno 2026')
    expect(iso(r?.start)).toBe('2026-03-10')
    expect(iso(r?.end)).toBe('2026-06-15')
  })

  it('parses a same-month range', () => {
    const r = parseDateRange('10 – 15 marzo 2026')
    expect(iso(r?.start)).toBe('2026-03-10')
    expect(iso(r?.end)).toBe('2026-03-15')
  })

  it('finds a range embedded in surrounding prose', () => {
    // The scraper feeds it whole page bodies, not tidy strings.
    const r = parseDateRange('La mostra sarà aperta dal 10 marzo al 15 giugno 2026 presso il museo.')
    expect(iso(r?.start)).toBe('2026-03-10')
    expect(iso(r?.end)).toBe('2026-06-15')
  })

  it('degrades to a single date with no end', () => {
    const r = parseDateRange('10 marzo 2026')
    expect(iso(r?.start)).toBe('2026-03-10')
    expect(r?.end).toBeUndefined()
  })

  it('returns undefined when there is no date at all', () => {
    expect(parseDateRange('nessuna data qui')).toBeUndefined()
    expect(parseDateRange('')).toBeUndefined()
  })
})
