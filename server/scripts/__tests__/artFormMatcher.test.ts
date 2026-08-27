import { describe, it, expect } from 'vitest'
import { matchArtForms, normalize } from '../artFormMatcher'

/**
 * The medium decides a card's tag and a pin's colour, so a wrong guess is
 * worse than no guess: an untagged show falls back to its format label, which
 * is at least true. These tests pin down that conservatism.
 */

describe('matchArtForms', () => {
  it('recognises the medium named in Italian', () => {
    expect(matchArtForms('100 Fotografie per ereditare il Mondo')).toEqual(['photography'])
    expect(matchArtForms('Lo Scultore della Belle Époque')).toEqual(['sculpture'])
    expect(matchArtForms('Passione Disegno. Da Leonardo a Haring')).toEqual(['drawing'])
  })

  it('recognises the medium named in English', () => {
    expect(matchArtForms('Sony World Photography Awards 2026')).toEqual(['photography'])
  })

  it('returns several media when several are named', () => {
    // Many-to-many exists precisely because this is normal.
    const forms = matchArtForms('Scultura e fotografia a confronto')
    expect(forms).toContain('sculpture')
    expect(forms).toContain('photography')
  })

  it('reads painting from an unambiguous movement', () => {
    // A named school implies a medium; a surname does not.
    expect(matchArtForms('I Macchiaioli')).toEqual(['painting'])
    expect(matchArtForms('Metafisica | Metafisiche')).toEqual(['painting'])
  })

  it('refuses to guess from an artist name', () => {
    // Warhol worked across media. Guessing here would colour a pin on a hunch.
    expect(matchArtForms('Andy Warhol. Passaggio in Italia 1975-1987')).toEqual([])
    expect(matchArtForms('Anselm Kiefer. Le Alchimiste')).toEqual([])
  })

  it('returns nothing rather than something for uninformative titles', () => {
    expect(matchArtForms('Milano Città Mondo')).toEqual([])
    expect(matchArtForms('')).toEqual([])
    expect(matchArtForms(null, undefined)).toEqual([])
  })

  it('reads the description as well as the title', () => {
    expect(matchArtForms('Untitled show', 'Una selezione di dipinti su tela.'))
      .toEqual(['painting'])
  })

  it('is not fooled by a word inside another word', () => {
    // Word boundaries matter: "designare" is not a design show.
    expect(matchArtForms('Come designare il futuro')).toEqual([])
  })
})

describe('normalize', () => {
  it('folds accents and apostrophes, as venue matching does', () => {
    expect(normalize('Belle Époque')).toBe(normalize('Belle Epoque'))
    expect(normalize('l’artista')).toBe(normalize("l'artista"))
  })
})
