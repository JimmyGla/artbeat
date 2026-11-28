import { describe, it, expect } from 'vitest'
import {
  parsePrice,
  matchFormat,
  looksFree,
  isValidEventTitle,
  isUsefulDescription,
  splitListingTitle,
  joinTitleLines,
} from '../extractors'

describe('splitListingTitle', () => {
  // Every arte.it row was stored with this whole string as its title.
  it('splits an arte.it og:title into show, city and venue', () => {
    expect(splitListingTitle('Futurismo 1918–1944 - Mostra - Milano - Bottegantica - Arte.it'))
      .toEqual({ title: 'Futurismo 1918–1944', city: 'Milano', venue: 'Bottegantica' })
  })

  it('keeps " - " inside the show title and inside the venue', () => {
    expect(splitListingTitle(
      'Gianluigi Toccafondo. Le prime stelle - Le dive italiane che sedussero il cinema - Mostra - Milano - MIC - Museo Interattivo del Cinema - Arte.it',
    )).toEqual({
      title: 'Gianluigi Toccafondo. Le prime stelle - Le dive italiane che sedussero il cinema',
      city:  'Milano',
      venue: 'MIC - Museo Interattivo del Cinema',
    })
  })

  it('reads a city outside Milan', () => {
    expect(splitListingTitle('Vedere oltre. Fotografia e sacro - Mostra - Cinisello Balsamo - Museo Nazionale di Fotografia - Arte.it').city)
      .toBe('Cinisello Balsamo')
  })

  it('leaves other titles alone', () => {
    expect(splitListingTitle('Matisse. Il mondo in una stanza')).toEqual({ title: 'Matisse. Il mondo in una stanza' })
    expect(splitListingTitle('  Spaced   title ')).toEqual({ title: 'Spaced title' })
  })
})

describe('parsePrice', () => {
  it('extracts a numeric price', () => {
    expect(parsePrice('€ 12')).toBe(12)
    expect(parsePrice('12,50')).toBe(12.5)   // Italian decimal comma
    expect(parsePrice('Biglietto intero: €20,00')).toBe(20)
  })

  it('treats free admission as no price', () => {
    // The schema uses price: null for free, so "free" and "unknown" collapse
    // to the same value. See the note below.
    expect(parsePrice('gratuito')).toBeUndefined()
    expect(parsePrice('ingresso libero')).toBeUndefined()
    expect(parsePrice('free')).toBeUndefined()
  })

  it('returns undefined when there is no number', () => {
    expect(parsePrice('')).toBeUndefined()
    expect(parsePrice('prezzo da definire')).toBeUndefined()
  })

  it('still cannot distinguish free from unknown on its own', () => {
    // Both are undefined here — by design. `looksFree` is what separates them,
    // and the Admission enum is what records the difference.
    expect(parsePrice('gratuito')).toBe(parsePrice('prezzo non disponibile'))
  })
})

describe('looksFree', () => {
  it('recognises explicit free admission', () => {
    expect(looksFree('Ingresso libero')).toBe(true)
    expect(looksFree('ingresso gratuito')).toBe(true)
    expect(looksFree('Free admission')).toBe(true)
  })

  it('does not treat a missing price as free', () => {
    // The distinction that stopped unparseable prices being advertised as free.
    expect(looksFree('prezzo non disponibile')).toBe(false)
    expect(looksFree('')).toBe(false)
    expect(looksFree('Biglietto intero €20')).toBe(false)
  })
})

describe('matchFormat', () => {
  it('detects openings', () => {
    expect(matchFormat('Vernissage giovedì', '')).toBe('OPENING')
    expect(matchFormat('Inaugurazione della sede', '')).toBe('OPENING')
  })

  it('detects performances, talks, workshops and screenings', () => {
    expect(matchFormat('Concerto per pianoforte', '')).toBe('PERFORMANCE')
    expect(matchFormat('Laboratorio per bambini', '')).toBe('WORKSHOP')
    expect(matchFormat('Incontro con l’artista', '')).toBe('TALK')
    expect(matchFormat('Proiezione di cortometraggi', '')).toBe('SCREENING')
  })

  it('defaults to exhibition', () => {
    expect(matchFormat('I Macchiaioli', 'Cento opere')).toBe('EXHIBITION')
  })

  it('does not let a venue name in the title decide the format', () => {
    // Regression: aggregator titles embed the venue, so "Teatro alla Scala"
    // used to classify an exhibition as a PERFORMANCE. An explicit
    // self-description ("Mostra") now wins over any venue keyword.
    expect(matchFormat('Mostra - Milano - Teatro alla Scala - Arte.it', '')).toBe('EXHIBITION')
    expect(matchFormat('Mostra - Milano - Teatro Franco Parenti', '')).toBe('EXHIBITION')
  })

  it('still classifies a genuine performance at a theatre', () => {
    expect(matchFormat('Spettacolo di danza contemporanea', '')).toBe('PERFORMANCE')
  })

  it('reads the description as well as the title', () => {
    expect(matchFormat('Untitled', 'Il vernissage si terrà giovedì')).toBe('OPENING')
  })
})

describe('isValidEventTitle', () => {
  it('rejects listing-page furniture', () => {
    expect(isValidEventTitle('Cosa fare a Milano')).toBe(false)
    expect(isValidEventTitle('Tutti gli eventi')).toBe(false)
    expect(isValidEventTitle('Mostre in corso')).toBe(false)
    expect(isValidEventTitle('Plan your visit')).toBe(false)
  })

  it('rejects titles that are too short to be real', () => {
    expect(isValidEventTitle('Arte')).toBe(false)
    expect(isValidEventTitle('')).toBe(false)
  })

  it('accepts genuine event titles', () => {
    expect(isValidEventTitle('I Macchiaioli - Mostra - Milano')).toBe(true)
  })
})

describe('isUsefulDescription', () => {
  const title = 'Andy Warhol. Passaggio in Italia - Mostra - Milano - Galleria X - Arte.it'

  it('rejects an exact echo of the title', () => {
    expect(isUsefulDescription(title, title)).toBe(false)
  })

  it('rejects a description that merely restates the title prefix', () => {
    // og:description is frequently the title plus a suffix.
    expect(isUsefulDescription(title + ' - qualcosa in più', title)).toBe(false)
  })

  it('rejects text too short to say anything', () => {
    expect(isUsefulDescription('Breve.', title)).toBe(false)
  })

  it('accepts genuine prose', () => {
    const real =
      'La mostra raccoglie oltre cento opere provenienti da collezioni private ' +
      'e ripercorre il rapporto tra l’artista e l’Italia negli anni Settanta.'
    expect(isUsefulDescription(real, title)).toBe(true)
  })

  it('ignores case and whitespace when comparing', () => {
    expect(isUsefulDescription(title.toUpperCase().replace(/ /g, '  '), title)).toBe(false)
  })
})

describe('joinTitleLines', () => {
  it('joins a two-line heading the way aggregators write it', () => {
    expect(joinTitleLines('Costantino Nivola\nScolpire il vento')).toBe('Costantino Nivola. Scolpire il vento')
  })

  it('does not double punctuation', () => {
    expect(joinTitleLines('Ettore Sottsass:\n  Design Metaphors')).toBe('Ettore Sottsass: Design Metaphors')
  })

  it('leaves a one-line title alone', () => {
    expect(joinTitleLines('  Photo Grant Deloitte 2026 ')).toBe('Photo Grant Deloitte 2026')
    expect(joinTitleLines('')).toBe('')
  })
})
