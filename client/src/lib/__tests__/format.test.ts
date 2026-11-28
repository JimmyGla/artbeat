import { describe, it, expect } from 'vitest'
import { accentColor, dateLabel } from '../format'

describe('accentColor', () => {
  it('uses the first art form colour', () => {
    expect(accentColor([{ color: '#0EA5E9' }, { color: '#000000' }])).toBe('#0EA5E9')
  })

  it('falls back when there are no art forms', () => {
    expect(accentColor([])).toBe('#7C3AED')
  })

  // The detail endpoint once omitted the field, and every show page crashed.
  it('falls back instead of throwing when the field is missing', () => {
    expect(accentColor(undefined)).toBe('#7C3AED')
    expect(accentColor(null, '#111111')).toBe('#111111')
  })
})

describe('dateLabel', () => {
  it('shows a range', () => {
    expect(dateLabel({ run: 'TEMPORARY', startsOn: '2026-11-11', endsOn: '2027-02-14' })).toBe('11 Nov 2026 – 14 Feb 2027')
  })

  // Triennale lists a show that is already on by its closing date only.
  it('shows the closing date when the start is unknown', () => {
    expect(dateLabel({ run: 'TEMPORARY', startsOn: null, endsOn: '2027-02-14' })).toBe('Until 14 Feb 2027')
  })

  it('shows nothing when no date is known', () => {
    expect(dateLabel({ run: 'TEMPORARY', startsOn: null, endsOn: null })).toBe('')
  })
})
