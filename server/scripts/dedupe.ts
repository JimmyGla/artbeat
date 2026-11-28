/**
 * How reconcile decides two rows are the same show: same venue (the caller
 * groups by it), similar title, coinciding run. Kept apart from reconcile.ts,
 * which runs on import, so the rules can be tested without a database.
 */

import { normalizeForMatch } from './venues'

/** Aggregators append their own name and boilerplate; strip it before comparing. */
export function titleKey(title: string): string {
  return normalizeForMatch(title)
    .replace(/\s*-\s*(mostra|mostre|exhibition)\s*-\s*/g, ' ')
    .replace(/\s*-\s*milano\s*-\s*/g, ' ')
    .replace(/\s*-\s*(arte\.it|milanotoday)\s*$/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 6)          // first six words carry the identity
    .join(' ')
}

/**
 * Do two runs coincide?
 *
 * Permanent runs have no dates by definition, so a date test can never group
 * them — which is how a typo fix in the seed file produced two copies of the
 * Castello Sforzesco collection that nothing could merge. Two permanent runs at
 * the same venue with the same title ARE the same thing; date overlap only
 * makes sense between temporary ones.
 */
export const overlaps = (
  a: { run: string; startsOn: Date | null; endsOn: Date | null },
  b: { run: string; startsOn: Date | null; endsOn: Date | null },
) => {
  if (a.run === 'PERMANENT' && b.run === 'PERMANENT') return true
  if (a.run !== b.run) return false
  // A run listed by its closing date only ("Fino al …", Triennale) began at
  // some unknown point before it ends, so treat its start as open.
  const OPEN = new Date(0)
  const aStart = a.startsOn ?? (a.endsOn ? OPEN : null)
  const bStart = b.startsOn ?? (b.endsOn ? OPEN : null)
  if (!aStart || !bStart) return false
  const aEnd = a.endsOn ?? aStart
  const bEnd = b.endsOn ?? bStart
  return aStart <= bEnd && bStart <= aEnd
}

/**
 * Similarity of two normalised titles, 0–1, by edit distance.
 *
 * Key-based grouping cannot catch a typo: fixing "Castelo" → "Castello" in the
 * seed file produced two rows whose keys differed by one character and so were
 * never compared. Edit distance handles that, while still keeping genuinely
 * different shows apart — they differ by far more than a character or two.
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (!a.length || !b.length) return 0

  // Iterative Levenshtein with a single row; titles are short.
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = curr
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length)
}

/** Above this, two titles at the same venue are the same show. */
export const TITLE_SIMILARITY = 0.9
