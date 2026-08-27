/**
 * Clear descriptions that merely repeat the event title.
 *
 * The old scraper ended its extraction chain in `|| title`, so 92% of stored
 * descriptions were a copy of the title.  The scraper no longer does this, but
 * it only revisits events currently listed by a source — rows that have
 * rotated off a listing keep their stale echo forever.
 *
 * Blanking them loses nothing: the title is already displayed above, and the
 * UI hides the About section when the description is empty.  Better an honest
 * gap than a paragraph that says nothing.
 *
 * Idempotent.  Run with `npm run db:repair-descriptions`.
 */

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const prisma = new PrismaClient()

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** Does this description carry information the title does not? */
function isEcho(description: string, title: string): boolean {
  const d = norm(description)
  const t = norm(title)
  if (!d) return false
  if (d === t) return true
  // Aggregator titles read "Name - Mostra - Milano - Venue - Arte.it"; a
  // description restating that opening adds nothing.
  if (d.startsWith(t.slice(0, Math.min(40, t.length)))) return true
  return false
}

async function main() {
  console.log('🔧 ArtBeat description repair\n')

  const events = await prisma.exhibition.findMany({ select: { id: true, title: true, description: true } })

  const echoes = events.filter((e) => isEcho(e.description, e.title))
  console.log(`  ${echoes.length} of ${events.length} description(s) echo the title\n`)

  for (const e of echoes) {
    await prisma.exhibition.update({ where: { id: e.id }, data: { description: '' } })
    console.log(`  cleared: ${e.title.slice(0, 62)}`)
  }

  console.log('\n─────────────────────────────────────────')
  console.log(`  Cleared : ${echoes.length}`)
  console.log(`  Kept    : ${events.length - echoes.length}`)
  console.log('─────────────────────────────────────────')
  if (echoes.length) {
    console.log('\nThese events now have no description. The About section is')
    console.log('hidden for them until a source provides real text.')
  }
}

main()
  .catch((err) => { console.error('Fatal error:', err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
