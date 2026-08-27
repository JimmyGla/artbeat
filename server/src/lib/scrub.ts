/**
 * Server-side redaction for telemetry.
 *
 * A near-duplicate of the client's `scrub`, and duplicated on purpose. The
 * client scrubs so personal data never leaves the device; this scrubs because
 * `POST /api/telemetry` is public, so anyone can send an unscrubbed body and
 * "the client already handled it" is then simply false. Two independent passes
 * mean a gap in one is not a leak into the database.
 *
 * Keep the rules in step with client/src/lib/telemetry.ts, but do not factor
 * them into a shared package: the point is that this pass runs even when the
 * client's did not.
 */

type Redaction = { pattern: RegExp; with: string | ((match: string, ...groups: string[]) => string) }

const REDACTIONS: Redaction[] = [
  // JWTs — Supabase access tokens.
  { pattern: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, with: '[jwt]' },

  // Email addresses.
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, with: '[email]' },

  // Named credentials. The optional quote before the separator is what makes
  // this match JSON bodies (`"access_token":"…"`), which is where tokens
  // actually appear.
  {
    pattern: /\b(bearer|token|apikey|api_key|access_token|refresh_token|password|secret)\b["']?(\s*[:=]\s*|\s+)["']?[^\s"',&}]+/gi,
    with: (_m, key: string) => `${key}=[redacted]`,
  },

  // Developer usernames from absolute paths in stack traces.
  { pattern: /\/Users\/[^/\s]+/g, with: '/Users/[user]' },

  // Long high-entropy strings that matched nothing more specific.
  { pattern: /\b[A-Za-z0-9_-]{40,}\b/g, with: '[token]' },
]

const URL_QUERY = /(\?|&)[^\s"']*/g

/** Redact and cap. Never throws — this runs inside a request handler. */
export function scrubServer(input: string, maxLength = 2_000): string {
  try {
    let text = String(input).replace(URL_QUERY, '$1[query]')
    for (const rule of REDACTIONS) {
      text = typeof rule.with === 'string'
        ? text.replace(rule.pattern, rule.with)
        : text.replace(rule.pattern, rule.with as (substring: string, ...args: unknown[]) => string)
    }
    return text.length > maxLength ? `${text.slice(0, maxLength)}…[truncated]` : text
  } catch {
    // Anything unexpected: keep nothing rather than risk storing raw input.
    return '[unprocessable]'
  }
}
