import { describe, it, expect } from 'vitest'
import { noTicketLinkNote } from '../format'

// A paid show without a ticket link used to say "Free entry — just show up".
describe('noTicketLinkNote', () => {
  it('only promises walk-in entry for free shows', () => {
    expect(noTicketLinkNote('FREE')).toBe('Free entry — just show up')
  })

  it('never calls a paid or unlisted show free', () => {
    expect(noTicketLinkNote('PAID')).not.toMatch(/free/i)
    expect(noTicketLinkNote('UNKNOWN')).not.toMatch(/free/i)
  })
})
