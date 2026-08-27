/**
 * Pure extraction helpers used by the scraper.
 *
 * Kept in their own module because `scrapeEvents.ts` calls `main()` at import
 * time — importing it from a test would launch a browser and start crawling.
 * These functions have no I/O, so they are the cheapest and most valuable
 * things in the pipeline to test: every one of them decides what ends up in
 * the database.
 */

/**
 * Parse a ticket price out of free text.
 *
 * Returns `undefined` for "free" — the schema uses `price: null` to mean free,
 * so a missing price and a free event are the same value. That ambiguity is
 * pre-existing; see the note in the tests.
 */
export function parsePrice(raw: string): number | undefined {
  if (!raw) return undefined
  const lower = raw.toLowerCase().trim()
  if (['free', 'gratuito', 'ingresso libero', 'gratis', '0'].includes(lower)) return undefined

  const match = raw.match(/€?\s*(\d{1,4}[.,]?\d{0,2})/)
  if (match) {
    const val = parseFloat(match[1].replace(',', '.'))
    return isNaN(val) ? undefined : val
  }
  return undefined
}

export type Format = 'EXHIBITION' | 'OPENING' | 'PERFORMANCE' | 'WORKSHOP' | 'TALK' | 'SCREENING'

/**
 * Classify how you encounter the thing.
 *
 * Order matters, and fixes a real misclassification: aggregator titles embed
 * the venue ("… - Mostra - Milano - Teatro alla Scala - Arte.it"), and the word
 * "teatro" used to match the performance rule — filing an exhibition held at a
 * theatre as a performance. An explicit exhibition marker now wins first,
 * because "mostra" describes the thing itself while a venue name does not.
 */
export function matchFormat(title: string, description: string): Format {
  const text = `${title} ${description}`.toLowerCase()

  // Explicit self-description beats any keyword that might be a venue name.
  if (/\b(mostra|mostre|exhibition|esposizione|retrospettiva)\b/.test(text)) return 'EXHIBITION'

  if (/\b(vernissage|inaugurazione|finissage|opening)\b/.test(text))                     return 'OPENING'
  if (/\b(screening|proiezione|film|cinema|cortometraggi)\b/.test(text))                 return 'SCREENING'
  if (/\b(workshop|laboratorio|masterclass|corso)\b/.test(text))                         return 'WORKSHOP'
  if (/\b(talk|conferenza|lecture|incontro|presentazione|dialogo)\b/.test(text))         return 'TALK'
  if (/\b(performance|concerto|concert|spettacolo|danza|dance|recital)\b/.test(text))    return 'PERFORMANCE'

  return 'EXHIBITION'
}

/**
 * Did a source actually say admission is free?
 *
 * Distinct from `parsePrice` returning undefined, which only means "no number
 * found". Treating those as the same is what advertised unparseable prices as
 * free.
 */
export function looksFree(raw: string): boolean {
  if (!raw) return false
  return /\b(ingresso libero|ingresso gratuito|entrata libera|gratuito|gratis|free admission|free entry)\b/i
    .test(raw)
}

/** Reject listing-page headings that are not actually event titles. */
export function isValidEventTitle(title: string): boolean {
  if (!title || title.length < 8) return false
  const t = title.toLowerCase()
  const bad = ['cosa fare', 'tutti gli eventi', 'weekend', 'plan your visit', 'mostre in corso', 'calendario', 'faq']
  return !bad.some(term => t.includes(term))
}

/**
 * Is this description actually saying something, or just echoing the title?
 *
 * 92% of stored descriptions were a copy of the title, because the extraction
 * chain ended in `|| title`. Many sites also set og:description to the title,
 * so the check has to compare content, not merely whether a value exists.
 */
export function isUsefulDescription(desc: string, title: string): boolean {
  const d = desc.trim()
  if (d.length < 60) return false

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const dn = norm(d)
  const tn = norm(title)

  if (dn === tn) return false
  // Aggregator titles look like "Name - Mostra - Milano - Venue - Arte.it";
  // a description that merely restates that prefix adds nothing.
  if (dn.startsWith(tn.slice(0, Math.min(40, tn.length)))) return false
  return true
}
