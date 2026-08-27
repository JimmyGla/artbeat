/**
 * Infer the medium of a show from its title and description.
 *
 * Pure and separate from the tagging script so it can be tested: this decides
 * what a card and a map pin are coloured by, and a wrong guess is worse than
 * no guess — an untagged show falls back to its format label, which is at
 * least true.
 *
 * Deliberately conservative. Keywords must name the medium, not merely appear
 * near it: "fotografia" tags photography, but a photographer's name does not,
 * because we cannot tell a photographer from a painter by name alone.
 */

export interface ArtFormRule {
  slug:     string
  patterns: RegExp[]
}

/**
 * Word-boundary matching on a normalised string. Italian and English both,
 * since sources mix them freely.
 */
export const ART_FORM_RULES: ArtFormRule[] = [
  { slug: 'photography', patterns: [
    /\bfotografi[ache]\b/, /\bfotografo\b/, /\bphotograph(y|s|ic)\b/, /\bphoto\b/,
    /\bscatti\b/, /\bimmagini fotografiche\b/,
  ]},
  { slug: 'painting', patterns: [
    /\bpittur[ae]\b/, /\bdipint[oi]\b/, /\bpainting(s)?\b/, /\bpittore\b/,
    /\btel[ae]\b/, /\bacquerell[oi]\b/, /\baffresch[oi]\b/,
    // Movements that are unambiguously painting. Named movements are safe in a
    // way artist names are not: "Macchiaioli" is a school of painters, whereas
    // a surname tells you nothing about medium.
    /\bmacchiaiol[ie]\b/, /\bimpressionis[mt]/, /\bfuturis[mt]/,
    /\bmetafisic[ah]/, /\bespressionis[mt]/, /\bsurrealis[mt]/,
    /\brinascimento\b/, /\bbarocco\b/, /\bveduti[sm]/,
  ]},
  { slug: 'sculpture', patterns: [
    /\bscultur[ae]\b/, /\bsculpture(s)?\b/, /\bscultore\b/, /\bsculptor\b/,
    /\bbronz[oi]\b/, /\bmarm[oi]\b/,
  ]},
  { slug: 'design', patterns: [
    /\bdesign\b/, /\bdisegno industriale\b/, /\barredo\b/, /\bfurniture\b/,
    /\btipografi[ache]\b/, /\btypograph(y|ic)\b/, /\bgrafic[ao]\b/,
  ]},
  { slug: 'performance', patterns: [
    /\bperformance\b/, /\bperformativ[ao]\b/, /\bdanza\b/, /\bdance\b/,
    /\bteatro\s+(fisico|danza)\b/,
  ]},
  { slug: 'installation', patterns: [
    /\binstallazion[ei]\b/, /\binstallation(s)?\b/, /\bsite-specific\b/,
    /\bambiente immersivo\b/, /\bimmersiv[ao]\b/,
  ]},
  { slug: 'video', patterns: [
    /\bvideo\b/, /\bvideoart\b/, /\bvideoarte\b/, /\bfilmic[ao]\b/,
    /\bmoving image\b/, /\bcinema sperimentale\b/,
  ]},
  { slug: 'drawing', patterns: [
    /\bdisegn[oi]\b/, /\bdrawing(s)?\b/, /\bcarboncino\b/, /\bschizz[oi]\b/,
    /\bopere su carta\b/, /\bworks on paper\b/,
  ]},
  { slug: 'architecture', patterns: [
    /\barchitettur[ae]\b/, /\barchitecture\b/, /\barchitetto\b/, /\barchitect\b/,
    /\burbanistic[ao]\b/,
  ]},
  { slug: 'textile', patterns: [
    /\btessil[ei]\b/, /\btextile(s)?\b/, /\barazz[oi]\b/, /\btapestry\b/,
    /\bmoda\b/, /\bfashion\b/, /\bcouture\b/, /\bsartori[ale]\b/,
  ]},
]

/** Fold accents and typographic apostrophes, same reasoning as venue matching. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ`´]/g, "'")
    .toLowerCase()
}

/**
 * All media named in the text. Multiple is normal and correct — a design show
 * can be typography and furniture at once, which is why the relation is
 * many-to-many.
 */
export function matchArtForms(...texts: (string | null | undefined)[]): string[] {
  const haystack = normalize(texts.filter(Boolean).join(' \n '))
  if (!haystack) return []

  return ART_FORM_RULES
    .filter((rule) => rule.patterns.some((re) => re.test(haystack)))
    .map((rule) => rule.slug)
}
