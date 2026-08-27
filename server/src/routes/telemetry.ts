import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma }   from '../lib/prisma'
import { apiError } from '../lib/errors'
import { scrubServer } from '../lib/scrub'

/**
 * Ingest for crash reports and product events.
 *
 * Unauthenticated by necessity: the crashes worth knowing about include the
 * ones that happen before or during sign-in, and a report that requires a valid
 * token would miss exactly those. That makes this the only public write
 * endpoint in the API, so it is treated as hostile input throughout:
 *
 *  • the body is validated strictly and anything unrecognised is rejected,
 *  • every string is re-scrubbed here rather than trusted from the client,
 *    because "the client already scrubbed it" stops being true the moment
 *    someone posts to this URL directly,
 *  • writes are rate-limited per address, so it cannot be used to fill the
 *    database,
 *  • nothing is echoed back, so it cannot be used as a reflector.
 *
 * It stores no account id and no IP address. `installId` is a random UUID
 * generated on the device.
 */
const router = Router()

// ── Rate limiting ───────────────────────────────────────────────────────────
//
// In-process and deliberately simple. A shared store (Redis) would be needed
// for several instances, but this is one small API and an approximate limit
// enforced everywhere beats an exact one that needs infrastructure to exist.

const WINDOW_MS   = 60_000
const MAX_PER_MIN = 30

const hits = new Map<string, { count: number; resetAt: number }>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  const entry = hits.get(key)

  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  entry.count++
  return entry.count > MAX_PER_MIN
}

// Unbounded growth would be a slow memory leak on a long-running process, and
// an easy one to cause from outside by rotating addresses.
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key)
}, WINDOW_MS).unref()

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * The event vocabulary, mirroring the client allowlist.
 *
 * Duplicated rather than shared because the two sides deploy independently: an
 * older app build must keep reporting after the server adds a name, and the
 * server must not accept a name it does not know. Keep in step with
 * client/src/lib/telemetry.ts EVENTS.
 */
const KNOWN_EVENTS = new Set([
  'app_opened', 'exhibition_viewed', 'venue_viewed', 'search_performed',
  'filter_applied', 'near_me_used', 'saved_added', 'saved_removed',
  'share_opened', 'reminders_enabled', 'external_link_opened',
])

/** Scalars only. Rejecting objects here is what stops nested PII arriving. */
const propValue = z.union([z.string().max(200), z.number(), z.boolean(), z.null()])

const payloadSchema = z.object({
  kind:       z.enum(['error', 'event']),
  name:       z.string().min(1).max(120),
  installId:  z.string().max(64),
  platform:   z.enum(['ios', 'android', 'web']),
  appVersion: z.string().max(40),
  message:    z.string().max(2_000).optional(),
  stack:      z.string().max(8_000).optional(),
  props:      z.record(propValue).optional(),
  at:         z.string().datetime(),
}).strict() // unknown keys are a bug or an attack; either way, refuse

router.post('/', async (req: Request, res: Response) => {
  // Trust the proxy header only for bucketing, never for storage.
  const forwarded = req.headers['x-forwarded-for']
  const key = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
    || req.ip
    || 'unknown'

  if (rateLimited(key)) {
    // 429 with no detail: a chatty limiter tells a prober how to pace itself.
    res.status(429).json({ error: 'Too many reports', status: 429 })
    return
  }

  const parsed = payloadSchema.safeParse(req.body)
  if (!parsed.success) {
    // Never reflect the offending value.
    apiError(res, 400, 'Malformed telemetry payload')
    return
  }
  const p = parsed.data

  if (p.kind === 'event' && !KNOWN_EVENTS.has(p.name)) {
    // Dropped, not an error: an older or newer client sending an unknown name
    // is expected, and it must not be recorded as a failure.
    res.status(202).send()
    return
  }

  try {
    // A client-supplied timestamp cannot be trusted to be sane — a wrong device
    // clock would otherwise write rows dated 1970 or 2093 and quietly break
    // every "errors this week" query.
    const claimed = new Date(p.at)
    const now = Date.now()
    const occurredAt =
      Math.abs(now - claimed.getTime()) > 7 * 24 * 60 * 60 * 1000 ? new Date() : claimed

    await prisma.telemetryEvent.create({
      data: {
        kind:       p.kind,
        name:       scrubServer(p.name, 120),
        installId:  p.installId,
        platform:   p.platform,
        appVersion: scrubServer(p.appVersion, 40),
        message:    p.message ? scrubServer(p.message, 2_000) : null,
        stack:      p.stack   ? scrubServer(p.stack,   8_000) : null,
        props:      sanitiseProps(p.props),
        occurredAt,
      },
    })

    // 202: accepted for processing, nothing to return. The client does not wait
    // on this and must not depend on the outcome.
    res.status(202).send()
  } catch (err) {
    console.error('[POST /telemetry]', err)
    // Still 202. A telemetry failure is our problem, and reporting it back
    // invites the client into a retry loop over something it cannot fix.
    res.status(202).send()
  }
})

/** Re-scrub string values and cap the map size. */
function sanitiseProps(props: Record<string, unknown> | undefined) {
  if (!props) return undefined
  const out: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(props).slice(0, 12)) {
    if (!/^[a-z][a-z0-9_]{0,30}$/.test(key)) continue
    if (typeof value === 'string')       out[key] = scrubServer(value, 200)
    else if (typeof value === 'number')  out[key] = Number.isFinite(value) ? value : 0
    else if (typeof value === 'boolean') out[key] = value
    else if (value === null)             out[key] = null
  }
  return out
}

export default router
