import { PrismaClient } from '@prisma/client'

/**
 * Dev-only: moves a user's `venueAlertsSeenAt` marker.
 *
 * "New at your places" is unverifiable on a fresh account by design — the
 * marker falls back to the signup date, so nothing scraped earlier counts as
 * new. Backdating it makes existing shows at hearted venues appear in the list
 * long enough to check the UI actually renders; `reset` puts it back to NULL.
 *
 *   npx tsx scripts/devSetAlertsMarker.ts <email>
 *   npx tsx scripts/devSetAlertsMarker.ts <email> reset
 */

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  const reset = process.argv[3] === 'reset'
  if (!email) {
    console.error('Usage: devSetAlertsMarker.ts <email> [reset]')
    process.exit(1)
  }

  const before = await prisma.user.findUnique({
    where:  { email },
    select: { createdAt: true, venueAlertsSeenAt: true },
  })
  if (!before) {
    console.error(`No user with email ${email}`)
    process.exit(1)
  }
  console.log('before:', before)

  await prisma.user.update({
    where: { email },
    data:  { venueAlertsSeenAt: reset ? null : new Date('2020-01-01T00:00:00Z') },
  })
  console.log('after :', reset ? 'NULL (restored)' : '2020-01-01 (temporary)')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
