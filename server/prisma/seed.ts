import { PrismaClient, VenueType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ── Clean slate (order matters — children before parents) ─────────────────
  await prisma.favorite.deleteMany()
  await prisma.event.deleteMany()
  await prisma.venue.deleteMany()
  await prisma.category.deleteMany()
  await prisma.city.deleteMany()
  await prisma.user.deleteMany()

  // ── City: Milan ───────────────────────────────────────────────────────────
  const milan = await prisma.city.create({
    data: {
      name:      'Milan',
      slug:      'milan',
      country:   'Italy',
      lat:       45.4654,
      lng:       9.1859,
      zoomLevel: 13,
      isActive:  true,
    },
  })
  console.log(`  ✓ City: ${milan.name}`)

  // ── City: Rome (coming soon — isActive: false) ────────────────────────────
  const rome = await prisma.city.create({
    data: {
      name:      'Rome',
      slug:      'rome',
      country:   'Italy',
      lat:       41.9028,
      lng:       12.4964,
      zoomLevel: 13,
      isActive:  false,
    },
  })
  console.log(`  ✓ City: ${rome.name} (coming soon)`)

  // ── Categories ────────────────────────────────────────────────────────────
  const [catExhibition, catPerformance, catOpening] = await Promise.all([
    prisma.category.create({ data: { name: 'Exhibition', slug: 'exhibition', color: '#7C3AED' } }),
    prisma.category.create({ data: { name: 'Performance', slug: 'performance', color: '#DC2626' } }),
    prisma.category.create({ data: { name: 'Opening',     slug: 'opening',     color: '#059669' } }),
  ])
  console.log('  ✓ Categories: Exhibition, Performance, Opening')

  // ── Venues ────────────────────────────────────────────────────────────────
  const [
    pinacotecaBrera,
    spazioSupersalone,
    baseMillano,
    teatroArsenalee,
    hangarBicocca,
  ] = await Promise.all([
    // 1 · Pinacoteca di Brera — iconic museum in the Brera district
    prisma.venue.create({
      data: {
        name:        'Pinacoteca di Brera',
        description: 'One of the most important art galleries in Italy, home to masterpieces by Raphael, Caravaggio and Mantegna.',
        address:     'Via Brera, 28, 20121 Milano MI',
        lat:         45.4722,
        lng:         9.1876,
        type:        VenueType.MUSEUM,
        website:     'https://pinacotecabrera.org',
        cityId:      milan.id,
      },
    }),
    // 2 · Spazio Supersalone — contemporary gallery in Porta Venezia
    prisma.venue.create({
      data: {
        name:        'Spazio Supersalone',
        description: 'A flexible contemporary art and design space near Porta Venezia, known for emerging Italian artists.',
        address:     'Viale Piave, 14, 20129 Milano MI',
        lat:         45.4737,
        lng:         9.2043,
        type:        VenueType.GALLERY,
        cityId:      milan.id,
      },
    }),
    // 3 · BASE Milano — multidisciplinary cultural hub in Navigli / Tortona
    prisma.venue.create({
      data: {
        name:        'BASE Milano',
        description: 'A creative hub in a former industrial building in the Tortona district, hosting art, music, performance and co-working.',
        address:     'Via Bergognone, 34, 20144 Milano MI',
        lat:         45.4564,
        lng:         9.1665,
        type:        VenueType.OTHER,
        website:     'https://base.milano.it',
        cityId:      milan.id,
      },
    }),
    // 4 · Teatro Arsenale — intimate theatre in Navigli
    prisma.venue.create({
      data: {
        name:        'Teatro Arsenale',
        description: 'A beloved independent theatre in the Navigli neighbourhood, specialising in experimental and physical performance.',
        address:     'Via Cesare Correnti, 11, 20123 Milano MI',
        lat:         45.4582,
        lng:         9.1787,
        type:        VenueType.THEATER,
        cityId:      milan.id,
      },
    }),
    // 5 · Hangar Bicocca — landmark contemporary art space in Bicocca
    prisma.venue.create({
      data: {
        name:        'Hangar Bicocca',
        description: 'A vast non-profit contemporary art space in a former industrial complex in Bicocca, known for large-scale installations.',
        address:     'Via Chiese, 2, 20126 Milano MI',
        lat:         45.5215,
        lng:         9.2134,
        type:        VenueType.MUSEUM,
        website:     'https://hangarbicocca.org',
        cityId:      milan.id,
      },
    }),
  ])
  console.log('  ✓ Venues: 5 Milan locations')

  // ── Events (10, spread April–June 2026) ───────────────────────────────────
  const events = await Promise.all([
    // 1 · Long-running exhibition at Brera (April–June)
    prisma.event.create({
      data: {
        title:       'Luce e Materia — Italian Post-War Art',
        description: 'A sweeping retrospective tracing the evolution of Italian post-war painting and sculpture. The exhibition brings together over 80 works by artists including Lucio Fontana, Alberto Burri and Piero Manzoni, exploring themes of light, surface and material experimentation.',
        startDate:   new Date('2026-04-05T10:00:00'),
        endDate:     new Date('2026-06-29T18:00:00'),
        price:       14,
        ticketUrl:   'https://pinacotecabrera.org/biglietti',
        categoryId:  catExhibition.id,
        venueId:     pinacotecaBrera.id,
      },
    }),
    // 2 · Opening at Brera
    prisma.event.create({
      data: {
        title:       'Opening Night — Luce e Materia',
        description: 'Invitation-only opening evening for "Luce e Materia", with a guided tour by the curators, a talk by the director and aperitivo in the courtyard of the Palazzo di Brera.',
        startDate:   new Date('2026-04-04T19:00:00'),
        price:       null, // free (invitation)
        categoryId:  catOpening.id,
        venueId:     pinacotecaBrera.id,
      },
    }),
    // 3 · Photography exhibition at Spazio Supersalone
    prisma.event.create({
      data: {
        title:       'Confini — Photography at the Margins of Europe',
        description: 'Twelve emerging documentary photographers present long-form projects on borders, migration and belonging across southern and eastern Europe. The show is accompanied by a printed zine available at the gallery.',
        startDate:   new Date('2026-04-12T11:00:00'),
        endDate:     new Date('2026-05-17T19:00:00'),
        price:       8,
        categoryId:  catExhibition.id,
        venueId:     spazioSupersalone.id,
      },
    }),
    // 4 · Opening at Spazio Supersalone
    prisma.event.create({
      data: {
        title:       'Vernissage — Confini',
        description: 'Opening evening for the group photography exhibition "Confini". Meet the photographers, enjoy wine and live DJ set in the gallery courtyard.',
        startDate:   new Date('2026-04-11T18:30:00'),
        price:       null,
        categoryId:  catOpening.id,
        venueId:     spazioSupersalone.id,
      },
    }),
    // 5 · Performance at BASE
    prisma.event.create({
      data: {
        title:       'Corpo Sonoro — Live Performance Festival',
        description: 'A two-day festival at BASE Milano celebrating the intersection of body, movement and sound. Twelve artists and collectives perform across the main hall and courtyard, including noise musicians, contemporary dancers and video artists.',
        startDate:   new Date('2026-05-02T17:00:00'),
        endDate:     new Date('2026-05-03T23:00:00'),
        price:       20,
        ticketUrl:   'https://base.milano.it/events',
        categoryId:  catPerformance.id,
        venueId:     baseMillano.id,
      },
    }),
    // 6 · Exhibition at BASE (Navigli / Tortona)
    prisma.event.create({
      data: {
        title:       'Archivio Futuro — Design and Memory',
        description: 'An exhibition exploring how design objects carry cultural memory. Curated by Studio Formafantasma, the show features archival furniture, prototypes and contemporary works that reinterpret Milanese design heritage.',
        startDate:   new Date('2026-05-10T10:00:00'),
        endDate:     new Date('2026-06-14T19:00:00'),
        price:       10,
        categoryId:  catExhibition.id,
        venueId:     baseMillano.id,
      },
    }),
    // 7 · Performance at Teatro Arsenale
    prisma.event.create({
      data: {
        title:       'Soglie — Physical Theatre',
        description: 'A new work by director Elena Russo exploring the threshold between sleep and waking, memory and loss. The piece uses silence, repetition and gestural language to create a meditative 70-minute experience for audiences of up to 60.',
        startDate:   new Date('2026-05-22T21:00:00'),
        endDate:     new Date('2026-05-25T21:00:00'),
        price:       18,
        ticketUrl:   'https://teatroarsenale.it',
        categoryId:  catPerformance.id,
        venueId:     teatroArsenalee.id,
      },
    }),
    // 8 · Opening at Teatro Arsenale
    prisma.event.create({
      data: {
        title:       'Opening Night — Soglie',
        description: 'First performance of "Soglie" followed by a conversation with director Elena Russo and the ensemble cast. Drinks offered after the show.',
        startDate:   new Date('2026-05-21T21:00:00'),
        price:       22,
        categoryId:  catOpening.id,
        venueId:     teatroArsenalee.id,
      },
    }),
    // 9 · Major exhibition at Hangar Bicocca
    prisma.event.create({
      data: {
        title:       'The Weight of Light — Olafur Eliasson',
        description: 'A major new commission by Olafur Eliasson fills the Navate space at Hangar Bicocca with a sprawling installation of mirrors, water and artificial fog. Visitors move through shifting fields of refracted colour in an experience designed to dissolve the boundary between viewer and environment.',
        startDate:   new Date('2026-04-18T10:00:00'),
        endDate:     new Date('2026-06-28T20:00:00'),
        price:       12,
        ticketUrl:   'https://hangarbicocca.org/events',
        categoryId:  catExhibition.id,
        venueId:     hangarBicocca.id,
      },
    }),
    // 10 · Outdoor performance / opening event at Hangar Bicocca
    prisma.event.create({
      data: {
        title:       'Solstice Night — Live Art at Hangar Bicocca',
        description: 'A special evening marking the summer solstice. The Hangar Bicocca gardens host live performances, a sound walk through the Eliasson installation and a late-night DJ set. Free entry from 8 pm; last entry 11 pm.',
        startDate:   new Date('2026-06-20T20:00:00'),
        price:       null,
        categoryId:  catPerformance.id,
        venueId:     hangarBicocca.id,
      },
    }),
  ])

  console.log(`  ✓ Events: ${events.length} seeded across 5 venues`)
  console.log('🎨 Seed complete!')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
