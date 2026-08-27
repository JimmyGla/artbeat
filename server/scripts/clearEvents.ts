import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const prisma = new PrismaClient()

async function main() {
  console.log('🗑  Clearing events from database...')

  const { count: favs }   = await prisma.favorite.deleteMany()
  const { count: events } = await prisma.exhibition.deleteMany()

  console.log(`   Deleted ${favs} favourite(s)`)
  console.log(`   Deleted ${events} event(s)`)
  console.log('✅ Done — cities, venues and categories are untouched.')
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
