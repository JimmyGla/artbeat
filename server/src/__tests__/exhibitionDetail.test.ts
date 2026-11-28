import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../app'

// The route's only dependency is Prisma; stub it so the test needs no database.
// vi.mock is hoisted above the imports, so `findUnique` must be hoisted too.
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }))
vi.mock('../lib/prisma', () => ({ prisma: { exhibition: { findUnique } } }))

beforeEach(() => findUnique.mockReset())

describe('GET /api/exhibitions/:id', () => {
  it('returns art forms flattened, as the list endpoint does', async () => {
    findUnique.mockResolvedValue({
      id: 'e1',
      title: 'Show',
      venue: { id: 'v1', name: 'Venue' },
      category: null,
      artForms: [{ artForm: { name: 'Photography', slug: 'photography', color: '#0EA5E9' } }],
    })

    const res = await request(app).get('/api/exhibitions/e1')

    expect(res.status).toBe(200)
    expect(res.body.artForms).toEqual([
      { name: 'Photography', slug: 'photography', color: '#0EA5E9' },
    ])
    expect(findUnique.mock.calls[0][0].include.artForms).toBeDefined()
  })

  it('returns an empty list for a show with no art forms', async () => {
    findUnique.mockResolvedValue({ id: 'e2', title: 'Show', venue: null, category: null, artForms: [] })

    const res = await request(app).get('/api/exhibitions/e2')

    expect(res.status).toBe(200)
    expect(res.body.artForms).toEqual([])
  })

  it('responds 404 for an unknown id', async () => {
    findUnique.mockResolvedValue(null)

    const res = await request(app).get('/api/exhibitions/nope')

    expect(res.status).toBe(404)
  })
})
