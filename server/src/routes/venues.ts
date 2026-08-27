import { Router, Request, Response } from 'express'
import { prisma }   from '../lib/prisma'
import { apiError } from '../lib/errors'
import { stillOn }  from '../lib/eventFilters'
import { openState, weeklySummary } from '../lib/openingHours'

/**
 * Venue detail.
 *
 * This endpoint did not exist: the client has always called
 * `GET /api/venues/:id`, which fell through to the 404 handler, so tapping any
 * venue showed "Venue not found". Nothing on the server ever served it.
 */
const router = Router()

router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const venue = await prisma.venue.findUnique({
      where: { id },
      include: {
        // `timezone` is needed to answer "open now" — the server's own clock is
        // not the venue's, and in summer Rome is two hours off UTC.
        city: { select: { name: true, slug: true, timezone: true } },
        openingHours: { select: { weekday: true, opensAt: true, closesAt: true } },
        closures:     { select: { date: true } },
        exhibitions: {
          // Same predicate as everywhere else, so a venue page cannot disagree
          // with the list that linked to it. Permanent collections included —
          // on a museum page they are the main event.
          where:  stillOn(),
          select: {
            id:         true,
            title:      true,
            run:        true,
            format:     true,
            startsOn:   true,
            endsOn:     true,
            admission:  true,
            priceCents: true,
            imageUrl:   true,
            venue:      { select: { id: true, name: true, kind: true } },
            artForms:   { select: { artForm: { select: { name: true, slug: true, color: true } } } },
          },
          // Permanent runs first — they are always available — then by date.
          orderBy: [{ run: 'asc' }, { startsOn: 'asc' }],
        },
      },
    })

    if (!venue) { apiError(res, 404, 'Venue not found'); return }

    res.json({
      id:          venue.id,
      name:        venue.name,
      description: venue.description,
      address:     venue.address,
      kind:        venue.kind,
      lat:         venue.lat,
      lng:         venue.lng,
      website:     venue.website,
      city:        { name: venue.city.name, slug: venue.city.slug },

      /**
       * Hours, computed server-side in the city's timezone.
       *
       * Deliberately not left to the client: the device clock and zone are
       * whatever the traveller's phone says, and a visitor from another
       * timezone would otherwise be told a Milan museum is open at 3am. The
       * server knows the venue's zone, so it answers the question.
       *
       * `status: 'unknown'` means we have no hours on record — distinct from
       * 'closed', which is a claim. The client must render nothing for unknown.
       */
      hours: {
        state:  openState(
          venue.openingHours,
          new Set(venue.closures.map((c) => c.date.toISOString().slice(0, 10))),
          venue.city.timezone,
        ),
        week:   weeklySummary(venue.openingHours),
        source: venue.hoursSourceUrl,
        checkedAt: venue.hoursCheckedAt,
      },

      // A placeholder venue is a bookkeeping row, not a place — say so rather
      // than rendering a map pin on the city centre.
      isPlaceholder: venue.isPlaceholder,
      imageUrl:    venue.imageUrl ?? venue.exhibitions.find((e) => e.imageUrl)?.imageUrl ?? null,
      exhibitions: venue.exhibitions.map((e) => ({ ...e, artForms: e.artForms.map((j) => j.artForm) })),
    })
  } catch (err) {
    console.error('[GET /venues/:id]', err)
    apiError(res, 500, 'Failed to fetch venue')
  }
})

export default router
