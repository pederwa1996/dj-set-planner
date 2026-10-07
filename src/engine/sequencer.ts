import { energyAt, type EnergyCurve } from './energy';
import { scoreTransition, type TransitionOptions } from './transition';
import type { MixTrack } from './types';

/**
 * Sequenceren finner en god rekkefølge for en samling låter.
 *
 * Kostnad for en rekkefølge = sum av
 *   - overgangskostnad (100 − overgangsscore) for hvert par
 *   - avvik fra energikurven × energyWeight for hver låt
 *   - straff når samme artist kommer for tett
 * delt på antall låter (så sett med ulik lengde kan sammenlignes),
 * pluss straff for avvik fra ønsket lengde.
 *
 * Søket er en beam search (bygger rekkefølgen låt for låt og beholder de
 * beste delløsningene), etterfulgt av lokal forbedring (bytt to låter,
 * snu et segment, bytt inn en ubrukt låt). Alternativer lages ved å
 * straffe overganger som allerede er brukt, så de blir faktisk forskjellige.
 */

export type LockPosition = 'first' | 'last' | number;
export interface Lock {
  trackId: string;
  position: LockPosition;
}

export interface SequencerOptions extends TransitionOptions {
  curve: EnergyCurve;
  /** Ønsket lengde i sekunder. Er potten lengre, velges et utvalg. */
  targetSec?: number | null;
  locks?: Lock[];
  alternatives?: number;
  /** Minst så mange låter mellom to låter av samme artist */
  artistGap?: number;
  /** Spilletid per låt i settet (standard: hele lengden, eller 5:30 hvis ukjent) */
  playSec?: (t: MixTrack) => number;
  beamWidth?: number;
  energyWeight?: number;
}

export interface SequenceResult {
  order: string[];
  totalSec: number;
  avgScore: number;
  minScore: number;
  cost: number;
}

export const DEFAULT_PLAY_SEC = 330;
export const defaultPlaySec = (t: MixTrack) => t.durationSec ?? DEFAULT_PLAY_SEC;

const ARTIST_PENALTY = 30;
const ALT_PAIR_PENALTY = 18;
const LENGTH_PENALTY_PER_MIN = 3;

/** Hovedartist, normalisert: "Above & Beyond feat. X" → "above" */
export function primaryArtist(artist: string): string {
  return (
    artist
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .split(/\s*[,&]\s*|\s+(?:and|x|vs\.?|feat\.?|ft\.?|featuring|with)\s+/)[0]
      ?.trim() ?? ''
  );
}

interface State {
  order: number[];
  used: Uint8Array;
  time: number;
  cost: number;
}

export function buildSequences(pool: MixTrack[], opts: SequencerOptions): SequenceResult[] {
  const n = pool.length;
  if (n === 0) return [];
  const playSec = opts.playSec ?? defaultPlaySec;
  const play = pool.map(playSec);
  const sumPlay = play.reduce((a, b) => a + b, 0);
  const target = opts.targetSec && opts.targetSec > 0 ? opts.targetSec : null;
  const denom = Math.max(1, target ? Math.min(target, sumPlay) : sumPlay);
  const energyWeight = opts.energyWeight ?? 6;
  const artistGap = opts.artistGap ?? 3;
  const artists = pool.map((t) => primaryArtist(t.artist));

  // Overgangskostnader regnes ut én gang
  const trans: Float64Array[] = pool.map((a, i) => {
    const row = new Float64Array(n);
    pool.forEach((b, j) => {
      if (i !== j) row[j] = 100 - scoreTransition(a, b, opts).score;
    });
    return row;
  });

  // Låste posisjoner
  const idxById = new Map(pool.map((t, i) => [t.id, i]));
  let firstIdx = -1;
  let lastIdx = -1;
  const middle = new Map<number, number>(); // posisjon → låtindeks
  const locked = new Uint8Array(n);
  for (const l of opts.locks ?? []) {
    const i = idxById.get(l.trackId);
    if (i === undefined || locked[i]) continue;
    if (l.position === 'first' || l.position === 0) {
      if (firstIdx >= 0) continue;
      firstIdx = i;
    } else if (l.position === 'last') {
      if (lastIdx >= 0) continue;
      lastIdx = i;
    } else {
      if (middle.has(l.position)) continue;
      middle.set(l.position, i);
    }
    locked[i] = 1;
  }
  const middlePositions = [...middle.keys()].sort((a, b) => a - b);
  const maxMiddle = middlePositions.length ? middlePositions[middlePositions.length - 1] : -1;
  const free = pool.map((_, i) => i).filter((i) => !locked[i]);

  const eCost = (i: number, startSec: number) => {
    const e = pool[i].energy;
    if (e == null) return 0;
    return Math.abs(e - energyAt(opts.curve, (startSec + play[i] / 2) / denom)) * energyWeight;
  };
  const artistCost = (order: number[], next: number) => {
    if (!artists[next]) return 0;
    for (let k = order.length - 1; k >= Math.max(0, order.length - artistGap); k--) {
      if (artists[order[k]] === artists[next]) return ARTIST_PENALTY;
    }
    return 0;
  };

  /** Full kostnad for en ferdig rekkefølge (samme mål som brukes til å sammenligne) */
  const evaluateFull = (order: number[], pairPenalty?: Map<number, number>) => {
    let cost = 0;
    let time = 0;
    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      cost += eCost(i, time);
      if (k > 0) {
        cost += trans[order[k - 1]][i];
        if (pairPenalty) cost += pairPenalty.get(order[k - 1] * n + i) ?? 0;
        cost += artistCost(order.slice(0, k), i);
      }
      time += play[i];
    }
    let mean = cost / Math.max(1, order.length);
    if (target) mean += (Math.abs(time - target) / 60) * LENGTH_PENALTY_PER_MIN;
    return { mean, time };
  };

  const beamWidth = opts.beamWidth ?? Math.max(16, Math.min(160, Math.floor(6000 / Math.max(1, n))));

  const runBeam = (pairPenalty: Map<number, number>): number[] => {
    const lastPlay = lastIdx >= 0 ? play[lastIdx] : 0;
    const isComplete = (s: State) => {
      const remainingFree = free.some((i) => !s.used[i]);
      const middleDone = s.order.length > maxMiddle;
      if (!remainingFree && middleDone) return true;
      return !!target && middleDone && s.time + lastPlay >= target;
    };
    const finalize = (s: State): { order: number[]; mean: number } => {
      const order = lastIdx >= 0 ? [...s.order, lastIdx] : s.order;
      return { order, mean: evaluateFull(order, pairPenalty).mean };
    };

    const mk = (order: number[], cost: number): State => {
      const used = new Uint8Array(n);
      let time = 0;
      for (const i of order) {
        used[i] = 1;
        time += play[i];
      }
      if (lastIdx >= 0) used[lastIdx] = 1;
      return { order, used, time, cost };
    };

    let beam: State[];
    if (firstIdx >= 0) beam = [mk([firstIdx], eCost(firstIdx, 0))];
    else if (middle.has(0)) beam = [mk([middle.get(0)!], eCost(middle.get(0)!, 0))];
    else {
      beam = free.map((i) => mk([i], eCost(i, 0)));
      if (!beam.length) beam = [mk([], 0)];
    }

    let best: { order: number[]; mean: number } | null = null;
    while (beam.length) {
      const next: { s: State; i: number; cost: number }[] = [];
      for (const s of beam) {
        if (s.order.length && isComplete(s)) {
          const f = finalize(s);
          if (!best || f.mean < best.mean) best = f;
          continue;
        }
        const pos = s.order.length;
        let candidates: number[];
        if (middle.has(pos)) candidates = [middle.get(pos)!];
        else {
          candidates = free.filter((i) => !s.used[i]);
          if (!candidates.length) {
            // Tomt for frie låter: plasser neste låste låt med en gang
            const p = middlePositions.find((mp) => !s.used[middle.get(mp)!]);
            candidates = p !== undefined ? [middle.get(p)!] : [];
          }
        }
        if (!candidates.length) {
          const f = finalize(s);
          if (!best || f.mean < best.mean) best = f;
          continue;
        }
        const prev = s.order[s.order.length - 1];
        for (const i of candidates) {
          let c = s.cost + eCost(i, s.time);
          if (prev !== undefined) c += trans[prev][i] + (pairPenalty.get(prev * n + i) ?? 0) + artistCost(s.order, i);
          next.push({ s, i, cost: c });
        }
      }
      next.sort((a, b) => a.cost - b.cost);
      beam = next.slice(0, beamWidth).map(({ s, i, cost }) => {
        const used = s.used.slice();
        used[i] = 1;
        return { order: [...s.order, i], used, time: s.time + play[i], cost };
      });
    }
    return best ? best.order : [];
  };

  /** Lokal forbedring: bytt, snu segmenter og bytt inn ubrukte låter så lenge det hjelper. */
  const improve = (start: number[], pairPenalty: Map<number, number>): number[] => {
    const evaluate = (o: number[]) => evaluateFull(o, pairPenalty);
    let order = [...start];
    const movable = (k: number) => !locked[order[k]];
    let cur = evaluate(order).mean;
    const deadline = Date.now() + 1500;
    for (let pass = 0; pass < 6 && Date.now() < deadline; pass++) {
      let improved = false;
      for (let a = 0; a < order.length; a++) {
        if (!movable(a)) continue;
        for (let b = a + 1; b < order.length; b++) {
          if (!movable(b)) continue;
          // Bytt to låter
          const sw = [...order];
          [sw[a], sw[b]] = [sw[b], sw[a]];
          const vs = evaluate(sw).mean;
          if (vs < cur - 1e-9) {
            order = sw;
            cur = vs;
            improved = true;
            continue;
          }
          // Snu segmentet a..b (bare hvis ingen låste låter inni)
          if (n <= 120 && b - a > 1) {
            let ok = true;
            for (let k = a; k <= b; k++) if (!movable(k)) ok = false;
            if (ok) {
              const rv = [...order.slice(0, a), ...order.slice(a, b + 1).reverse(), ...order.slice(b + 1)];
              const vr = evaluate(rv).mean;
              if (vr < cur - 1e-9) {
                order = rv;
                cur = vr;
                improved = true;
              }
            }
          }
        }
      }
      // Bytt inn en låt som ikke er med (når settet er et utvalg)
      const inSet = new Uint8Array(n);
      order.forEach((i) => (inSet[i] = 1));
      const unused = free.filter((i) => !inSet[i]);
      if (unused.length) {
        for (let a = 0; a < order.length; a++) {
          if (!movable(a)) continue;
          for (const u of unused) {
            if (inSet[u]) continue;
            const rp = [...order];
            const out = rp[a];
            rp[a] = u;
            const vp = evaluate(rp).mean;
            if (vp < cur - 1e-9) {
              inSet[out] = 0;
              inSet[u] = 1;
              order = rp;
              cur = vp;
              improved = true;
            }
          }
        }
      }
      if (!improved) break;
    }
    return order;
  };

  const wanted = Math.max(1, opts.alternatives ?? 3);
  const penalties = new Map<number, number>();
  const results: number[][] = [];
  const seen = new Set<string>();
  for (let k = 0; k < wanted + 2 && results.length < wanted; k++) {
    const raw = runBeam(penalties);
    if (!raw.length) break;
    // Alternativer forbedres med straffen på, så de ikke glir tilbake til det beste settet
    const order = improve(raw, new Map(penalties));
    const key = order.join(',');
    for (let i = 1; i < order.length; i++) {
      const p = order[i - 1] * n + order[i];
      penalties.set(p, (penalties.get(p) ?? 0) + ALT_PAIR_PENALTY);
    }
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(order);
  }

  return results
    .map((order) => {
      const scores = order.slice(1).map((i, k) => 100 - trans[order[k]][i]);
      const ev = evaluateFull(order);
      return {
        order: order.map((i) => pool[i].id),
        totalSec: ev.time,
        avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100,
        minScore: scores.length ? Math.min(...scores) : 100,
        cost: Math.round(ev.mean * 100) / 100,
      };
    })
    .sort((a, b) => a.cost - b.cost);
}
