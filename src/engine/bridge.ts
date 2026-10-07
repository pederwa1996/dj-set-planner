import { compatibleKeys, harmonicCompatibility } from './camelot';
import { tempoCompatibility } from './tempo';
import { scoreTransition, type TransitionOptions } from './transition';
import type { MixTrack } from './types';

export interface IdealBridge {
  /** Keys som passer med begge låtene (best først) */
  keys: string[];
  bpm: number | null;
  energy: number | null;
  /** f.eks. "trenger: 9A eller 8B, ca. 128 BPM, energi 6" */
  description: string;
}

/** Hva ville den perfekte låten mellom a og b vært? */
export function idealBridge(a: MixTrack, b: MixTrack): IdealBridge {
  let keys: string[] = [];
  if (a.camelot && b.camelot) {
    const fromA = compatibleKeys(a.camelot, { includeDiagonal: true });
    const both = fromA.filter((k) => compatibleKeys(b.camelot!, { includeDiagonal: true }).includes(k));
    // Sorter: best snitt mot begge
    const rank = (k: string) => (harmonicCompatibility(a.camelot!, k)?.score ?? 0) + (harmonicCompatibility(k, b.camelot!)?.score ?? 0);
    keys = (both.length ? both : fromA).sort((x, y) => rank(y) - rank(x)).slice(0, 4);
  } else keys = compatibleKeys((a.camelot ?? b.camelot) || '', {}).slice(0, 4);

  let bpm: number | null = null;
  if (a.bpm && b.bpm) {
    const t = tempoCompatibility(a.bpm, b.bpm);
    bpm = Math.round(((a.bpm + t.effective) / 2) * 10) / 10;
  } else bpm = a.bpm ?? b.bpm ?? null;

  const energy = a.energy != null && b.energy != null ? Math.round((a.energy + b.energy) / 2) : (a.energy ?? b.energy ?? null);

  const parts = [keys.length ? keys.slice(0, 3).join(' eller ') : null, bpm ? `ca. ${Math.round(bpm)} BPM` : null, energy != null ? `energi ${energy}` : null].filter(Boolean);
  return { keys, bpm, energy, description: parts.length ? `trenger: ${parts.join(', ')}` : 'mangler data for å foreslå' };
}

export interface BridgeCandidate<T extends MixTrack> {
  track: T;
  /** Svakeste av de to nye overgangene (0–100) */
  score: number;
  into: number;
  out: number;
  /** Hvor mye bedre enn den direkte overgangen */
  gain: number;
}

/** Ranger låter som kan settes inn mellom a og b. */
export function findBridges<T extends MixTrack>(a: MixTrack, b: MixTrack, pool: T[], opts: TransitionOptions & { limit?: number; exclude?: Set<string> } = {}): BridgeCandidate<T>[] {
  const direct = scoreTransition(a, b, opts).score;
  return pool
    .filter((c) => c.id !== a.id && c.id !== b.id && !opts.exclude?.has(c.id) && (c.bpm != null || c.camelot != null))
    .map((c) => {
      const into = scoreTransition(a, c, opts).score;
      const out = scoreTransition(c, b, opts).score;
      const score = Math.min(into, out);
      return { track: c, score, into, out, gain: score - direct };
    })
    .filter((x) => x.score >= 55)
    .sort((x, y) => y.score - x.score || y.into + y.out - (x.into + x.out))
    .slice(0, opts.limit ?? 10);
}
