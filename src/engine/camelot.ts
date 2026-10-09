/**
 * Camelot-hjulet: konvertering mellom vanlig notasjon og Camelot,
 * og harmonisk kompatibilitet mellom to keys.
 *
 * Camelot lagres som streng, f.eks. "8A" (moll) eller "8B" (dur).
 */

export type CamelotLetter = 'A' | 'B';
export interface CamelotKey {
  num: number; // 1–12
  letter: CamelotLetter; // A = moll, B = dur
}

// Indeks 0 = 1A/1B, indeks 11 = 12A/12B
const MINOR_NAMES = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db'];
const MAJOR_NAMES = ['B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E'];

// Pitch class (C = 0) for hver tonenavn, inkludert enharmoniske varianter
const PITCH: Record<string, number> = {
  C: 0, 'B#': 0,
  'C#': 1, Db: 1,
  D: 2,
  'D#': 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, 'E#': 5,
  'F#': 6, Gb: 6,
  G: 7,
  'G#': 8, Ab: 8,
  A: 9,
  'A#': 10, Bb: 10,
  B: 11, Cb: 11,
};

const minorByPitch = new Map<number, number>();
const majorByPitch = new Map<number, number>();
MINOR_NAMES.forEach((n, i) => minorByPitch.set(PITCH[n], i + 1));
MAJOR_NAMES.forEach((n, i) => majorByPitch.set(PITCH[n], i + 1));

export const ALL_CAMELOT: string[] = Array.from({ length: 12 }, (_, i) => [`${i + 1}A`, `${i + 1}B`]).flat();

export function formatCamelot(k: CamelotKey): string {
  return `${k.num}${k.letter}`;
}

/** Les "8A", "08a", "8 A" → { num: 8, letter: 'A' } */
export function parseCamelot(input: string): CamelotKey | null {
  const m = input.trim().match(/^0?(1[0-2]|[1-9])\s*([ABab])$/);
  if (!m) return null;
  return { num: Number(m[1]), letter: m[2].toUpperCase() as CamelotLetter };
}

/** Open Key-notasjon (Traktor): "1m" = A moll = 8A, "1d" = C dur = 8B */
function parseOpenKey(input: string): CamelotKey | null {
  const m = input.trim().match(/^0?(1[0-2]|[1-9])\s*([mdMD])$/);
  if (!m) return null;
  const n = Number(m[1]);
  return { num: ((n + 6) % 12) + 1, letter: m[2].toLowerCase() === 'm' ? 'A' : 'B' };
}

/**
 * Les vanlig notasjon: "A minor", "Am", "A min", "Amin", "C#m", "Db major",
 * "F#", "Bbmaj", "A moll", "C dur", "G♯m", "E♭".
 */
export function parseMusicalKey(input: string): CamelotKey | null {
  const s = input.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  const m = s.match(/^([A-Ga-g])([#b]?)\s*(.*)$/);
  if (!m) return null;
  const note = m[1].toUpperCase() + m[2];
  const pitch = PITCH[note];
  if (pitch === undefined) return null;
  const rest = m[3].trim().toLowerCase();
  let minor: boolean;
  if (rest === '' || /^(maj|major|dur|d)$/.test(rest)) minor = false;
  else if (/^(m|min|minor|moll)$/.test(rest)) minor = true;
  else return null;
  const num = (minor ? minorByPitch : majorByPitch).get(pitch)!;
  return { num, letter: minor ? 'A' : 'B' };
}

/** Prøver Camelot, Open Key og vanlig notasjon (i den rekkefølgen). */
export function parseAnyKey(input: string | null | undefined): CamelotKey | null {
  if (!input) return null;
  return parseCamelot(input) ?? parseOpenKey(input) ?? parseMusicalKey(input);
}

/** Normaliser hva som helst til Camelot-streng, eller null. */
export function toCamelot(input: string | null | undefined): string | null {
  const k = parseAnyKey(input);
  return k ? formatCamelot(k) : null;
}

/** "8A" → "A minor", "8B" → "C major" */
export function camelotToMusical(camelot: string | null | undefined, style: 'long' | 'short' = 'long'): string {
  const k = camelot ? parseCamelot(camelot) : null;
  if (!k) return '';
  const name = (k.letter === 'A' ? MINOR_NAMES : MAJOR_NAMES)[k.num - 1];
  if (style === 'short') return k.letter === 'A' ? `${name}m` : name;
  return `${name} ${k.letter === 'A' ? 'minor' : 'major'}`;
}

/** Alle keys i vanlig notasjon, sortert etter Camelot (til nedtrekkslister). */
export function musicalKeyOptions(): { camelot: string; musical: string }[] {
  return ALL_CAMELOT.map((c) => ({ camelot: c, musical: camelotToMusical(c) }));
}

/** Avstand rundt hjulet fra a til b, normalisert til -5…+6 */
export function wheelStep(from: number, to: number): number {
  let d = (((to - from) % 12) + 12) % 12;
  if (d > 6) d -= 12;
  return d;
}

export type HarmonicRelation =
  | 'same'
  | 'adjacent' // ±1, samme bokstav
  | 'relative' // samme tall, A↔B
  | 'diagonal' // +1 og A→B, eller -1 og B→A
  | 'boost2' // +2, samme bokstav (energiløft)
  | 'boost7' // +7 (= +1 halvtone), samme bokstav (energiløft)
  | 'clash';

export interface HarmonicResult {
  relation: HarmonicRelation;
  score: number; // 0–1
  step: number; // steg rundt hjulet (-5…+6)
  label: string; // kort norsk forklaring
}

export function harmonicCompatibility(fromKey: string, toKey: string): HarmonicResult | null {
  const a = parseCamelot(fromKey);
  const b = parseCamelot(toKey);
  if (!a || !b) return null;
  const step = wheelStep(a.num, b.num);
  const sameLetter = a.letter === b.letter;
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  if (sameLetter && step === 0) return { relation: 'same', score: 1, step, label: 'same key' };
  if (sameLetter && Math.abs(step) === 1)
    return { relation: 'adjacent', score: 0.9, step, label: `${sign(step)} on the wheel` };
  if (!sameLetter && step === 0)
    return {
      relation: 'relative',
      score: 0.85,
      step,
      label: a.letter === 'A' ? 'relative major (A→B)' : 'relative minor (B→A)',
    };
  if (!sameLetter && ((step === 1 && a.letter === 'A') || (step === -1 && a.letter === 'B')))
    return { relation: 'diagonal', score: 0.6, step, label: `diagonal (${sign(step)} and ${a.letter}→${b.letter})` };
  if (sameLetter && step === 2) return { relation: 'boost2', score: 0.6, step, label: '+2 on the wheel (energy boost)' };
  if (sameLetter && step === -5)
    // +7 rundt hjulet tilsvarer -5 i normalisert form
    return { relation: 'boost7', score: 0.5, step: 7, label: '+7 on the wheel (semitone up, energy boost)' };

  const dist = Math.abs(step) + (sameLetter ? 0 : 1);
  return {
    relation: 'clash',
    score: Math.max(0, 0.3 - dist * 0.05),
    step,
    label: `${sign(step)} on the wheel${sameLetter ? '' : `, ${a.letter}→${b.letter}`} (clash)`,
  };
}

/** Keys som er harmonisk kompatible med en gitt key (inkl. den selv). */
export function compatibleKeys(camelot: string, opts: { includeBoosts?: boolean; includeDiagonal?: boolean } = {}): string[] {
  const k = parseCamelot(camelot);
  if (!k) return [];
  const wrap = (n: number) => ((((n - 1) % 12) + 12) % 12) + 1;
  const other: CamelotLetter = k.letter === 'A' ? 'B' : 'A';
  const out = [
    formatCamelot(k),
    formatCamelot({ num: wrap(k.num + 1), letter: k.letter }),
    formatCamelot({ num: wrap(k.num - 1), letter: k.letter }),
    formatCamelot({ num: k.num, letter: other }),
  ];
  if (opts.includeDiagonal) out.push(formatCamelot({ num: wrap(k.num + (k.letter === 'A' ? 1 : -1)), letter: other }));
  if (opts.includeBoosts) {
    out.push(formatCamelot({ num: wrap(k.num + 2), letter: k.letter }));
    out.push(formatCamelot({ num: wrap(k.num + 7), letter: k.letter }));
  }
  return out;
}

/** Sorteringsnøkkel: 1A, 1B, 2A, … 12B */
export function camelotSortValue(camelot: string | null | undefined): number {
  const k = camelot ? parseCamelot(camelot) : null;
  return k ? k.num * 2 + (k.letter === 'B' ? 1 : 0) : Number.POSITIVE_INFINITY;
}

/**
 * Keys en automatisk analyse oftest forveksler med denne: dur/moll-paret
 * (samme tall, A↔B) og nabotrinnene (en kvint opp/ned, ±1 på hjulet).
 */
export function likelyMisreads(camelot: string | null | undefined): string[] {
  const k = camelot ? parseCamelot(camelot) : null;
  if (!k) return [];
  const wrap = (n: number) => ((((n - 1) % 12) + 12) % 12) + 1;
  return [
    formatCamelot({ num: k.num, letter: k.letter === 'A' ? 'B' : 'A' }),
    formatCamelot({ num: wrap(k.num - 1), letter: k.letter }),
    formatCamelot({ num: wrap(k.num + 1), letter: k.letter }),
  ];
}
