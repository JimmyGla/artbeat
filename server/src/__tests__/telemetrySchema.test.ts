import { describe, it, expect } from 'vitest'
import { payloadSchema } from '../routes/telemetry'

// The endpoint is public, so the schema is the PII boundary. Pinned here so a
// zod upgrade that changes what it accepts fails a test instead of silently
// letting nested objects or extra keys through.

const base = {
  kind:       'event',
  name:       'app_opened',
  installId:  'install-123',
  platform:   'ios',
  appVersion: '1.0.0',
  at:         '2026-10-29T10:00:00.000Z',
}

const accepts = (v: unknown) => payloadSchema.safeParse(v).success

describe('telemetry payloadSchema', () => {
  it('accepts a minimal event', () => {
    expect(accepts(base)).toBe(true)
  })

  it('accepts scalar props', () => {
    expect(accepts({ ...base, props: { count: 3, query: 'x', ok: true, none: null } })).toBe(true)
  })

  it('rejects nested objects in props', () => {
    expect(accepts({ ...base, props: { user: { email: 'a@b.c' } } })).toBe(false)
  })

  it('rejects unknown top-level keys', () => {
    expect(accepts({ ...base, email: 'a@b.c' })).toBe(false)
  })

  it('rejects a non-ISO timestamp', () => {
    expect(accepts({ ...base, at: 'yesterday' })).toBe(false)
  })

  it('rejects an over-long prop string', () => {
    expect(accepts({ ...base, props: { q: 'x'.repeat(201) } })).toBe(false)
  })
})
