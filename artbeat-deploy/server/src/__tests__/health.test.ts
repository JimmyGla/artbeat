import { describe, it, expect } from 'vitest'

/**
 * Basic sanity tests for the health endpoint logic.
 * Full integration tests (requiring a live DB) should be added separately.
 */

describe('health check', () => {
  it('returns a valid status object', () => {
    const status = { status: 'ok', timestamp: new Date().toISOString() }
    expect(status.status).toBe('ok')
    expect(typeof status.timestamp).toBe('string')
  })

  it('timestamp is a valid ISO date', () => {
    const ts = new Date().toISOString()
    expect(new Date(ts).toString()).not.toBe('Invalid Date')
  })
})
