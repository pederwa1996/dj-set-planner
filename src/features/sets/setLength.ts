import type { DjSet } from '../../db/types';
import { playSecFor } from '../../db/sets';

/** Det som avgjør hvor mange låter et set får plass til */
export type LengthChoice = Pick<DjSet, 'targetMinutes' | 'playMode' | 'fixedMinutes'>;

export const LENGTH_PRESETS = [30, 45, 60, 90, 120];
export const DEFAULT_LENGTH: LengthChoice = { targetMinutes: 60, playMode: 'full', fixedMinutes: 3.5 };

const KEY = 'newSetDefaults';

/** Siste valg for nye set (huskes i denne nettleseren) */
export function getLengthDefaults(): LengthChoice {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_LENGTH, ...JSON.parse(raw) } : DEFAULT_LENGTH;
  } catch {
    return DEFAULT_LENGTH;
  }
}

export function saveLengthDefaults(c: LengthChoice) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ targetMinutes: c.targetMinutes, playMode: c.playMode, fixedMinutes: c.fixedMinutes }));
  } catch {
    /* full eller blokkert lagring */
  }
}

/** 52 min · 1 h · 4 h 12 min */
export function formatLength(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

export interface LengthEstimate {
  /** Antall låter vi regner på (0 = ingen pott ennå) */
  count: number;
  /** Samlet spilletid for alle låtene */
  totalSec: number;
  /** Omtrent hvor mange låter settet får plass til (null = ingen grense) */
  fits: number | null;
  /** Spilletid per låt i snitt */
  avgSec: number;
}

/** Hvor mange av låtene får plass i settet? Uten låter regnes det med en typisk låtlengde. */
export function estimateLength(durations: (number | null)[], c: LengthChoice): LengthEstimate {
  const play = playSecFor(c);
  const secs = durations.map((d) => play({ durationSec: d }));
  const totalSec = secs.reduce((a, b) => a + b, 0);
  const avgSec = secs.length ? totalSec / secs.length : play({ durationSec: null });
  const target = c.targetMinutes && c.targetMinutes > 0 ? c.targetMinutes * 60 : null;
  if (!target) return { count: secs.length, totalSec, fits: null, avgSec };
  const fits = Math.max(1, Math.round(target / avgSec));
  return { count: secs.length, totalSec, fits: secs.length ? Math.min(secs.length, fits) : fits, avgSec };
}

/** Kort forklaring av hva lengden betyr for potten */
export function describeLength(e: LengthEstimate, c: LengthChoice, opts: { keepAll?: boolean } = {}): string {
  const target = c.targetMinutes && c.targetMinutes > 0 ? c.targetMinutes * 60 : null;
  const len = `${c.targetMinutes} min`;
  const each = c.playMode === 'fixed' ? `${c.fixedMinutes} min each` : `whole tracks, about ${Math.round(e.avgSec / 60)} min each`;
  if (!e.count) {
    if (!target) return 'No limit: every track you add to the pool goes into the set.';
    return `A ${len} set is about ${e.fits} tracks (${each}).`;
  }
  const n = `${e.count} track${e.count === 1 ? '' : 's'}`;
  if (opts.keepAll || !target) {
    const vs = target ? (Math.abs(e.totalSec - target) < 120 ? ' — right on target' : e.totalSec > target ? ` — ${formatLength(e.totalSec - target)} over` : ` — ${formatLength(target - e.totalSec)} short`) : '';
    return `All ${n} go in: about ${formatLength(e.totalSec)}${vs}.`;
  }
  if (e.totalSec <= target + 60) return `All ${n} fit (about ${formatLength(e.totalSec)})${e.totalSec < target - 120 ? ` — add more to fill ${len}` : ''}.`;
  return `These ${n} last about ${formatLength(e.totalSec)}. A ${len} set uses about ${e.fits} of them — the engine picks the ones that flow best and keeps the rest in reserve. Choose a longer set or “No limit” to use more.`;
}
