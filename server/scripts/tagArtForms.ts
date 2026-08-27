/**
 * Tag events with their medium, retroactively.
 *
 * The scraper does this for new rows; this catches everything already stored.
 * Idempotent — re-running only adds tags that are missing, and never removes a
 * tag, because a human may have corrected one by hand.
 *
 * Run with `npm run db:tag-art-forms`. Pass `--dry` to see what it would do.
 */

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { matchArtForms } from './artFormMatcher'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const prisma = new PrismaClient()
const DRY = process.argv.includes('--dry')

async function main() {
  console.log(`🎨 Tagging art forms${DRY ? ' (dry run)' : ''}\n`)

  const forms = await prisma.artForm.findMany({ select: { id: true, slug: true } })
  const idBySlug = new Map(forms.map((f) => [f.slug, f.id]))

  if (idBySlug.size === 0) {
    console.error('✗ No art forms seeded. The model_v2 migration inserts them.')
    process.exitCode = 1
    return
  }

  const events = await prisma.exhibition.findMany({
    select: {
      id: true, title: true, description: true,
      artForms: { select: { artFormId: true } },
    },
  })

  let tagged = 0
  let added = 0
  const untagged: string[] = []
  const spread = new Map<string, number>()

  for (const e of events) {
    const slugs = matchArtForms(e.title, e.description)

    if (slugs.length === 0) {
      if (e.artForms.length === 0) untagged.push(e.title)
      continue
    }

    const existing = new Set(e.artForms.map((j) => j.artFormId))
    const toAdd = slugs
      .map((s) => idBySlug.get(s))
      .filter((id): id is string => Boolean(id) && !existing.has(id!))

    for (const s of slugs) spread.set(s, (spread.get(s) ?? 0) + 1)

    if (toAdd.length === 0) continue

    if (!DRY) {
      await prisma.exhibitionArtForm.createMany({
        data: toAdd.map((artFormId) => ({ exhibitionId: e.id, artFormId })),
        skipDuplicates: true,
      })
    }

    tagged++
    added += toAdd.length
    console.log(`  ${slugs.join(', ').padEnd(28)} ${e.title.slice(0, 52)}`)
  }

  console.log('\n─────────────────────────────────────────')
  console.log(`  Events tagged : ${tagged}`)
  console.log(`  Tags added    : ${added}`)
  console.log(`  Still untagged: ${untagged.length}`)
  if (spread.size) {
    console.log(`\n  By medium:`)
    for (const [slug, n] of [...spread].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${slug.padEnd(14)} ${n}`)
    }
  }
  console.log('─────────────────────────────────────────')

  if (untagged.length) {
    console.log('\nUntagged events keep their format label and the default pin')
    console.log('colour — an honest fallback. A few examples:')
    untagged.slice(0, 5).forEach((t) => console.log(`  • ${t.slice(0, 66)}`))
    console.log('\nIf a medium is obvious to you but missed here, add a pattern')
    console.log('to ART_FORM_RULES in scripts/artFormMatcher.ts.')
  }
}

main()
  .catch((err) => { console.error('Fatal error:', err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
