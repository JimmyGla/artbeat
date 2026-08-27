import { describe, it, expect } from 'vitest'
import { scrub, EVENTS } from '../telemetry'

/**
 * Telemetry is the one subsystem whose bugs are not bugs but incidents: it
 * exists to send data off the device, so a gap in `scrub` ships personal data
 * to a server. Every case below is a way real PII could reach a crash report,
 * taken from the shapes this app actually produces.
 *
 * The bias throughout is towards over-redaction. An unreadable stack trace
 * costs an afternoon; a leaked Supabase token costs a rotation and a breach
 * assessment.
 */

describe('scrub — credentials', () => {
  it('removes a Supabase JWT from an error message', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const out = scrub(`Request failed: Authorization: Bearer ${jwt}`)
    expect(out).not.toContain(jwt)
    expect(out).not.toContain('eyJ')
  })

  it('removes a bare JWT with no surrounding context', () => {
    const out = scrub('eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MX0.abcdefghijklmnop')
    expect(out).toBe('[jwt]')
  })

  it('redacts a named token value but keeps the key', () => {
    // Keeping the key means the report still says which credential was
    // involved, which is the only part worth knowing.
    const out = scrub('{"access_token":"sk_live_9f8a7b6c5d4e3f2a1b","ok":false}')
    expect(out).not.toContain('sk_live_9f8a7b6c5d4e3f2a1b')
    expect(out.toLowerCase()).toContain('access_token')
  })

  it('redacts passwords and secrets however they are written', () => {
    for (const s of ['password: hunter2xyz', 'password=hunter2xyz', 'secret = hunter2xyz']) {
      expect(scrub(s)).not.toContain('hunter2xyz')
    }
  })

  it('removes long high-entropy strings that match no specific rule', () => {
    const key = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0'
    expect(scrub(`unexpected value ${key}`)).not.toContain(key)
  })
})

describe('scrub — personal data', () => {
  it('removes an email address', () => {
    const out = scrub('Failed to sign in albertobalboni212@gmail.com')
    expect(out).not.toContain('albertobalboni212')
    expect(out).not.toContain('gmail.com')
    expect(out).toContain('[email]')
  })

  it('removes emails embedded in a URL or JSON', () => {
    expect(scrub('{"email":"a.b+tag@sub.example.co.uk"}')).not.toContain('example.co.uk')
  })

  it('drops query strings wholesale', () => {
    // Query strings are the least predictable carrier — anything can end up
    // there, so none of it is kept.
    const out = scrub('GET /api/saved?token=abc&email=me@x.com failed')
    expect(out).not.toContain('me@x.com')
    expect(out).not.toContain('abc')
  })

  it("removes the developer's username from absolute paths", () => {
    const out = scrub('at file:///Users/Alberto/Desktop/Projects/artbeat/client/src/main.tsx:12')
    expect(out).not.toContain('Alberto')
    expect(out).toContain('/Users/[user]')
  })
})

describe('scrub — robustness', () => {
  it('keeps ordinary diagnostic text readable', () => {
    // Over-redaction is preferred, but a stack trace still has to be usable.
    const out = scrub('TypeError: Cannot read properties of undefined (reading \'venue\')')
    expect(out).toContain('TypeError')
    expect(out).toContain('venue')
  })

  it('handles non-strings without throwing', () => {
    expect(() => scrub(null)).not.toThrow()
    expect(() => scrub(undefined)).not.toThrow()
    expect(() => scrub(42)).not.toThrow()
    expect(() => scrub({ a: 1 })).not.toThrow()
    expect(scrub(null)).toBe('')
  })

  it('survives a circular object', () => {
    // Error contexts routinely contain React or DOM objects with cycles;
    // throwing here would break the very report being sent.
    const cyclic: Record<string, unknown> = { name: 'x' }
    cyclic.self = cyclic
    expect(() => scrub(cyclic)).not.toThrow()
    expect(scrub(cyclic)).toContain('circular')
  })

  it('truncates rather than sending an unbounded payload', () => {
    // Realistic long input: many short words, so no single-token rule collapses
    // it and truncation is genuinely what bounds the size.
    const out = scrub('at renderRow line 12 '.repeat(500), 100)
    expect(out.length).toBeLessThan(200)
    expect(out).toContain('truncated')
  })

  it('does not leak through a JSON-stringified object', () => {
    const out = scrub({ user: { email: 'me@example.com' }, ok: false })
    expect(out).not.toContain('me@example.com')
  })
})

describe('EVENTS allowlist', () => {
  it('has no duplicates', () => {
    expect(new Set(EVENTS).size).toBe(EVENTS.length)
  })

  it('uses snake_case names only', () => {
    // The allowlist is the analytics schema; inconsistent names produce
    // dimensions that silently never line up.
    for (const name of EVENTS) expect(name).toMatch(/^[a-z][a-z0-9_]*$/)
  })

  it('contains no event that implies recording free text or identity', () => {
    // A tripwire against future additions: the moment an event is named for a
    // query, an email, or a user, the schema has started collecting PII.
    for (const name of EVENTS) {
      expect(name).not.toMatch(/email|query|user_id|name|address|token/)
    }
  })
})
