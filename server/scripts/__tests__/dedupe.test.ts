import { describe, it, expect } from 'vitest'
import { overlaps, similarity, titleKey, TITLE_SIMILARITY } from '../dedupe'

const day = (iso: string) => new Date(`${iso}T00:00:00Z`)
const run = (startsOn: string | null, endsOn: string | null) => ({
  run: 'TEMPORARY', startsOn: startsOn ? day(startsOn) : null, endsOn: endsOn ? day(endsOn) : null,
})

describe('overlaps', () => {
  it('matches a closing-date-only run with the same show from arte.it', () => {
    // Triennale gives only "Fino al 14 febbraio 2027"; arte.it has both dates.
    expect(overlaps(run(null, '2027-02-14'), run('2026-11-11', '2027-02-14'))).toBe(true)
  })

  it('keeps apart a closing-date-only run and a later run of the same title', () => {
    expect(overlaps(run(null, '2026-06-30'), run('2026-11-11', '2027-02-14'))).toBe(false)
  })

  it('never matches a run with no dates at all', () => {
    expect(overlaps(run(null, null), run('2026-11-11', '2027-02-14'))).toBe(false)
  })
})

describe('titleKey', () => {
  it("treats the venue's and arte.it's titles as the same show", () => {
    // arte.it as stored (its listing suffix is split off at scrape time) and
    // Triennale's two-line heading, joined; with and without the full stop.
    const arteIt = titleKey('Correspondences. Soundwalk Collective & Patti Smith')
    expect(similarity(titleKey('Correspondences. Soundwalk Collective & Patti Smith'), arteIt)).toBe(1)
    expect(similarity(titleKey('Correspondences Soundwalk Collective & Patti Smith'), arteIt))
      .toBeGreaterThanOrEqual(TITLE_SIMILARITY)
  })
})
