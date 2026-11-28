import { describe, it, expect } from 'vitest'
import { accentColor } from '../format'

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
