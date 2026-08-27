import { Capacitor } from '@capacitor/core'
import { API_BASE } from './api'

/**
 * Crash reporting and product analytics, first-party.
 *
 * The app already told users "This has been noted" on its crash screen while
 * reporting nothing anywhere, and unhandled promise rejections were entirely
 * silent. This module makes that claim true.
 *
 * Three constraints shape every decision here, in this order:
 *
 *  1. **No personal data leaves the device.** This is an EU app, and the most
 *     likely leak is not a deliberate one — it is an email address or a
 *     Supabase JWT sitting inside an error message that gets forwarded
 *     verbatim. Everything is scrubbed on the way out, and `scrub` is the most
 *     heavily tested function in the client.
 *  2. **Events are an allowlist.** A free-form `track(name, props)` becomes a
 *     PII leak the first time someone passes a user object. Only known event
 *     names are accepted, and properties are coerced to a narrow shape.
 *  3. **Failing to report must never break the app.** Every path swallows its
 *     own errors. Telemetry that can crash the thing it is measuring is worse
 *     than none.
 *
 * There is no third-party SDK here on purpose: with no DSN configured a
 * bundled Sentry would be dead weight. `send` is the single seam — point it at
 * a vendor later without touching any call site.
 */

// ── Identity ────────────────────────────────────────────────────────────────

const INSTALL_ID_KEY = 'artbeat.installId'
const OPT_OUT_KEY     = 'artbeat.telemetryOptOut'

/**
 * A random per-install id, never the account id.
 *
 * Enough to tell "one user hit this 40 times" from "40 users hit it once",
 * which is the whole analytical value, without identifying anybody. It is not
 * derived from the device, so it cannot be correlated with any other app, and
 * it dies with the install.
 */
export function installId(): string {
  try {
    const existing = localStorage.getItem(INSTALL_ID_KEY)
    if (existing) return existing
    const fresh = crypto.randomUUID()
    localStorage.setItem(INSTALL_ID_KEY, fresh)
    return fresh
  } catch {
    // Private mode or a storage failure — report anonymously rather than not
    // at all. Grouping is lost, which is a fair trade for a crash report.
    return 'unknown'
  }
}

export function hasOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === '1'
  } catch {
    // Unreadable storage means unknowable consent, and the safe reading of
    // unknowable consent is "no".
    return true
  }
}

export function setOptedOut(value: boolean): void {
  try {
    if (value) localStorage.setItem(OPT_OUT_KEY, '1')
    else localStorage.removeItem(OPT_OUT_KEY)
  } catch { /* nothing useful to do */ }
}

// ── Scrubbing ───────────────────────────────────────────────────────────────

/**
 * Patterns removed from every string before it leaves the device.
 *
 * Ordered most specific first: a JWT also matches the long-token rule, and
 * replacing it as a JWT is more informative when reading the report later.
 */
type Redaction = { pattern: RegExp; with: string | ((match: string, ...groups: string[]) => string) }

const REDACTIONS: Redaction[] = [
  // JWTs — Supabase access tokens turn up inside fetch error messages.
  { pattern: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, with: '[jwt]' },

  // Email addresses.
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, with: '[email]' },

  // Credentials named in headers, JSON, or query strings. The key is kept and
  // only the value replaced, so a report still says *what* was missing.
  {
    // The `["']?` before the separator matters: in JSON the key is quoted, so
    // the text reads `"access_token":"sk_live_…"` and a pattern expecting the
    // colon straight after the key name misses every JSON body — which is the
    // most common place a token actually shows up.
    pattern: /\b(bearer|token|apikey|api_key|access_token|refresh_token|password|secret)\b["']?(\s*[:=]\s*|\s+)["']?[^\s"',&}]+/gi,
    with: (_m, key: string) => `${key}=[redacted]`,
  },

  // Absolute paths leak the developer's username on dev builds.
  { pattern: /\/Users\/[^/\s]+/g, with: '/Users/[user]' },

  // Anything long and high-entropy that survived the rules above.
  { pattern: /\b[A-Za-z0-9_-]{40,}\b/g, with: '[token]' },
]

/** Query strings can carry anything, so they are dropped wholesale. */
const URL_QUERY = /(\?|&)[^\s"']*/g

/**
 * Strip anything identifying from a string.
 *
 * Deliberately aggressive: an over-redacted stack trace is still debuggable,
 * whereas a leaked token is a security incident. When in doubt this removes.
 */
export function scrub(input: unknown, maxLength = 2000): string {
  if (input === null || input === undefined) return ''
  let text = typeof input === 'string' ? input : safeStringify(input)

  text = text.replace(URL_QUERY, '$1[query]')
  for (const rule of REDACTIONS) {
    text = typeof rule.with === 'string'
      ? text.replace(rule.pattern, rule.with)
      : text.replace(rule.pattern, rule.with as (substring: string, ...args: unknown[]) => string)
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}…[truncated]` : text
}

/** JSON.stringify that cannot throw on cycles or exotic values. */
function safeStringify(value: unknown): string {
  try {
    const seen = new WeakSet()
    return JSON.stringify(value, (_k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[circular]'
        seen.add(v)
      }
      if (typeof v === 'bigint')   return String(v)
      if (typeof v === 'function') return '[function]'
      return v
    }) ?? String(value)
  } catch {
    return String(value)
  }
}

// ── Events ──────────────────────────────────────────────────────────────────

/**
 * Every event the app may report.
 *
 * An allowlist rather than free-form strings: it keeps the vocabulary
 * reviewable in one place, and it means a typo produces a dropped event rather
 * than a new dimension nobody notices. Add here first, then call.
 *
 * Nothing here records *what* a user likes in a way tied to them — the install
 * id groups events, and none of these carry an account, a title, or a query.
 */
export const EVENTS = [
  'app_opened',
  'exhibition_viewed',
  'venue_viewed',
  'search_performed',
  'filter_applied',
  'near_me_used',
  'saved_added',
  'saved_removed',
  'share_opened',
  'reminders_enabled',
  'external_link_opened',
] as const

export type EventName = (typeof EVENTS)[number]

/**
 * Event properties: small, non-identifying scalars only.
 *
 * Strings are scrubbed and length-capped. Free-form text is the main way PII
 * gets into analytics, so a search event records the *length* of the query and
 * how many results came back, never the query itself.
 */
export type EventProps = Record<string, string | number | boolean | null>

const MAX_PROP_KEYS = 10

function sanitiseProps(props: EventProps | undefined): EventProps {
  if (!props) return {}
  const out: EventProps = {}
  for (const [key, value] of Object.entries(props).slice(0, MAX_PROP_KEYS)) {
    if (!/^[a-z][a-z0-9_]{0,30}$/.test(key)) continue
    if (typeof value === 'string')        out[key] = scrub(value, 80)
    else if (typeof value === 'number')   out[key] = Number.isFinite(value) ? value : 0
    else if (typeof value === 'boolean')  out[key] = value
    else if (value === null)              out[key] = null
  }
  return out
}

// ── Transport ───────────────────────────────────────────────────────────────

interface Payload {
  kind:      'error' | 'event'
  installId: string
  platform:  string
  appVersion: string
  name:      string
  message?:  string
  stack?:    string
  props?:    EventProps
  at:        string
}

/** Client-side cap: a render loop must not turn into thousands of requests. */
const MAX_PER_SESSION = 40
let sentThisSession = 0

/** Identical errors repeat; report the first few and count the rest silently. */
const seen = new Map<string, number>()
const MAX_PER_SIGNATURE = 3

/**
 * The single seam for delivery.
 *
 * Swap this body for a vendor SDK and every call site keeps working. Uses
 * keepalive so a report survives the navigation or backgrounding that often
 * accompanies a crash.
 */
async function send(payload: Payload): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/telemetry`, {
      method:   'POST',
      headers:  { 'Content-Type': 'application/json' },
      body:     JSON.stringify(payload),
      keepalive: true,
    })
  } catch {
    // Offline, or the dev server's IP moved. Losing telemetry is acceptable;
    // surfacing it to the user is not.
  }
}

function base(kind: Payload['kind'], name: string): Payload {
  return {
    kind,
    installId:  installId(),
    platform:   Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web',
    appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev',
    name,
    at:         new Date().toISOString(),
  }
}

function allowed(): boolean {
  if (hasOptedOut()) return false
  if (sentThisSession >= MAX_PER_SESSION) return false
  return true
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Report a caught or uncaught error. Never throws. */
export function reportError(error: unknown, context?: EventProps): void {
  try {
    // Always visible locally, opt-out or not — the console is the developer's,
    // not a data collection channel.
    console.error('[telemetry]', error)
    if (!allowed()) return

    const err = error instanceof Error ? error : new Error(String(error))
    const signature = `${err.name}:${(err.message || '').slice(0, 80)}`
    const count = (seen.get(signature) ?? 0) + 1
    seen.set(signature, count)
    if (count > MAX_PER_SIGNATURE) return

    sentThisSession++
    void send({
      ...base('error', err.name || 'Error'),
      message: scrub(err.message, 500),
      stack:   scrub(err.stack, 4000),
      props:   { ...sanitiseProps(context), occurrence: count },
    })
  } catch { /* telemetry must never be the cause of a crash */ }
}

/** Record a product event. Unknown names are dropped, not sent. */
export function track(name: EventName, props?: EventProps): void {
  try {
    if (!EVENTS.includes(name)) return
    if (!allowed()) return
    sentThisSession++
    void send({ ...base('event', name), props: sanitiseProps(props) })
  } catch { /* ignore */ }
}

/**
 * Attach global handlers.
 *
 * Called once at start-up. Without these, only React render errors were ever
 * noticed: a failed promise or an error inside a callback vanished, which is
 * precisely the class of bug that is hardest to reproduce from a user report.
 */
export function installGlobalHandlers(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (e) => {
    reportError(e.error ?? e.message, { source: 'window.error' })
  })

  window.addEventListener('unhandledrejection', (e) => {
    reportError(e.reason, { source: 'unhandledrejection' })
  })
}

/** Test seam: reset the per-session counters. */
export function __resetForTests(): void {
  sentThisSession = 0
  seen.clear()
}
