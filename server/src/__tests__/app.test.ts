import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../app'

// No real services: vitest.config.mts points DATABASE_URL at a closed port and
// gives Supabase placeholder values.

describe('GET /health', () => {
  it('responds 200 without touching the database', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})

describe('GET /ready', () => {
  it('responds 503 when the database is unreachable', async () => {
    const res = await request(app).get('/ready')
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ status: 'not ready', database: 'down' })
  }, 20_000)
})

describe('unknown routes', () => {
  it('respond 404 as JSON', async () => {
    const res = await request(app).get('/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Not found', status: 404 })
  })
})

describe('CORS', () => {
  it.each([
    'http://localhost:5173',
    'capacitor://localhost',
    'https://localhost',
  ])('allows %s', async (origin) => {
    const res = await request(app).get('/health').set('Origin', origin)
    expect(res.headers['access-control-allow-origin']).toBe(origin)
  })

  it('does not allow an unknown origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example')
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })
})
