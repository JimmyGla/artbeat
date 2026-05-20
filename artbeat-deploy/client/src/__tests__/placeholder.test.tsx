import { describe, it, expect } from 'vitest'

/**
 * Placeholder test suite.
 * Ensures the Vitest setup is working and CI does not fail with zero tests.
 * Replace / extend this with real component tests as the app grows.
 */

describe('app bootstrap', () => {
  it('1 + 1 equals 2', () => {
    expect(1 + 1).toBe(2)
  })

  it('formats a date string correctly', () => {
    const d = new Date('2024-03-15T00:00:00Z')
    const formatted = d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
    expect(formatted).toBe('15 Mar 2024')
  })
})
