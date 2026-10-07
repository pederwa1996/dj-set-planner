import { normalizeText, normalizeVersion } from '../lib/normalize';
import type { LookupQuery } from './types';

function tokens(s: string): string[] {
  return normalizeText(s).split(' ').filter(Boolean);
}

/** Dice-koeffisient på ord, 0–1 */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const setB = new Map<string, number>();
  tb.forEach((t) => setB.set(t, (setB.get(t) ?? 0) + 1));
  let common = 0;
  for (const t of ta) {
    const n = setB.get(t) ?? 0;
    if (n > 0) {
      common++;
      setB.set(t, n - 1);
    }
  }
  return (2 * common) / (ta.length + tb.length);
}

/** Artistnavn kan være "A, B & C" — godta treff mot hvilken som helst del eller helheten. */
function artistSimilarity(query: string, candidate: string): number {
  const parts = (s: string) => s.split(/\s*(?:,|&|\band\b|\bx\b|\bvs\.?|\bfeat\.?|\bft\.?)\s*/i).filter(Boolean);
  let best = similarity(query, candidate);
  for (const q of parts(query)) for (const c of parts(candidate)) best = Math.max(best, similarity(q, c) * 0.95);
  return best;
}

/**
 * Hvor godt matcher et treff det vi søkte etter? Artist og tittel gir grunnscoren;
 * versjon (remix) skalerer den, fordi en annen remix ofte har annen BPM/key.
 */
/** Samme låt i annen lengde/utgave — har som regel samme BPM og key som originalen */
const LENGTH_VARIANT = /^(radio( edit| version| mix)?|edit|single( version| edit)?|clean|explicit|short( edit)?|remaster(ed)?( \d{4})?( version)?|\d{4} remaster(ed)?|mono|stereo)$/;

function versionKey(v: string | undefined): string {
  const n = normalizeVersion(v ?? '');
  return LENGTH_VARIANT.test(n) ? '' : n;
}

export function matchScore(q: LookupQuery, c: { artist: string; title: string; version?: string }): number {
  const a = artistSimilarity(q.artist, c.artist);
  const t = similarity(q.title, c.title);
  const qv = versionKey(q.version);
  const cv = versionKey(c.version);
  let v: number;
  if (!qv && !cv) v = 1;
  else if (qv && cv) v = 0.75 + 0.25 * similarity(qv, cv);
  else v = 0.75; // original vs. remix: kan ha annen BPM/key, så aldri automatisk
  return Math.round((0.5 * a + 0.5 * t) * v * 1000) / 1000;
}
