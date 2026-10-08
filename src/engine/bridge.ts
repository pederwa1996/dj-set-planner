import { compatibleKeys, harmonicCompatibility } from './camelot';
import { tempoCompatibility } from './tempo';
import { ISSUE, scoreTransition, type TransitionOptions, type TransitionScore } from './transition';
import type { MixTrack } from './types';

export interface IdealBridge {
  /** Keys som passer med begge låtene (best først) */
  keys: string[];
  bpm: number | null;
  energy: number | null;
  /** e.g. "needs: 9A or 8B, ~128 BPM, energy 6" */
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

  const parts = [keys.length ? keys.slice(0, 3).join(' or ') : null, bpm ? `~${Math.round(bpm)} BPM` : null, energy != null ? `energy ${energy}` : null].filter(Boolean);
  return { keys, bpm, energy, description: parts.length ? `needs: ${parts.join(', ')}` : 'not enough data to suggest' };
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

/** En overgang vi ikke vil foreslå: tonearter som skurrer, eller for stort tempohopp */
const isHard = (t: TransitionScore | null) => !!t && (t.issues.includes(ISSUE.keyClash) || t.issues.includes(ISSUE.bpmJump));

/** Ranger låter som kan settes inn mellom a og b. */
export function findBridges<T extends MixTrack>(a: MixTrack, b: MixTrack, pool: T[], opts: TransitionOptions & { limit?: number; exclude?: Set<string> } = {}): BridgeCandidate<T>[] {
  const direct = scoreTransition(a, b, opts).score;
  return pool
    .filter((c) => c.id !== a.id && c.id !== b.id && !opts.exclude?.has(c.id) && (c.bpm != null || c.camelot != null))
    .map((c) => {
      const into = scoreTransition(a, c, opts);
      const out = scoreTransition(c, b, opts);
      const score = isHard(into) || isHard(out) ? 0 : Math.min(into.score, out.score);
      return { track: c, score, into: into.score, out: out.score, gain: score - direct };
    })
    .filter((x) => x.score >= 55)
    .sort((x, y) => y.score - x.score || y.into + y.out - (x.into + x.out))
    .slice(0, opts.limit ?? 10);
}

export interface Replacement<T extends MixTrack> {
  track: T;
  /** Svakeste av de nye overgangene (0–100) */
  score: number;
  /** Overgang fra låten før (null hvis den byttes ut først i settet) */
  into: number | null;
  /** Overgang til låten etter (null hvis den er sist) */
  out: number | null;
  /** Hvor godt energien passer kurven her (null hvis ukjent) */
  energyFit: number | null;
}

/**
 * Låter som kan erstatte en låt mellom `prev` og `next`. Én av dem (eller begge)
 * kan mangle når låten er først eller sist i settet. Energien teller litt når kurven
 * gir et mål for plassen.
 */
export function findReplacements<T extends MixTrack>(
  prev: MixTrack | null,
  next: MixTrack | null,
  pool: T[],
  opts: TransitionOptions & { limit?: number; exclude?: Set<string>; targetEnergy?: number | null; minScore?: number } = {},
): Replacement<T>[] {
  const rank = (r: Replacement<T>) => (r.energyFit == null ? r.score : r.score * 0.85 + r.energyFit * 0.15);
  return pool
    .filter((c) => c.id !== prev?.id && c.id !== next?.id && !opts.exclude?.has(c.id) && (c.bpm != null || c.camelot != null))
    .map((c): Replacement<T> => {
      const tIn = prev ? scoreTransition(prev, c, opts) : null;
      const tOut = next ? scoreTransition(c, next, opts) : null;
      const into = tIn?.score ?? null;
      const out = tOut?.score ?? null;
      const parts = [into, out].filter((n): n is number => n != null);
      const energyFit = opts.targetEnergy != null && c.energy != null ? Math.max(0, 100 - Math.abs(c.energy - opts.targetEnergy) * 20) : null;
      const score = isHard(tIn) || isHard(tOut) ? 0 : parts.length ? Math.min(...parts) : 100;
      return { track: c, score, into, out, energyFit };
    })
    .filter((x) => x.score >= (opts.minScore ?? 55))
    .sort((x, y) => rank(y) - rank(x) || (y.into ?? 0) + (y.out ?? 0) - ((x.into ?? 0) + (x.out ?? 0)))
    .slice(0, opts.limit ?? 10);
}

/** Hva ville passet best på denne plassen? */
export function idealReplacement(prev: MixTrack | null, next: MixTrack | null, targetEnergy: number | null): IdealBridge {
  const base = prev && next ? idealBridge(prev, next) : prev || next ? idealBridge((prev ?? next)!, (prev ?? next)!) : null;
  if (!base) return { keys: [], bpm: null, energy: targetEnergy, description: 'not enough data to suggest' };
  const energy = targetEnergy != null ? Math.round(targetEnergy) : base.energy;
  const parts = [base.keys.length ? base.keys.slice(0, 3).join(' or ') : null, base.bpm ? `~${Math.round(base.bpm)} BPM` : null, energy != null ? `energy ${energy}` : null].filter(Boolean);
  return { ...base, energy, description: parts.length ? `needs: ${parts.join(', ')}` : 'not enough data to suggest' };
}
