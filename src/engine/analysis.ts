import { energyAt, type EnergyCurve } from './energy';
import { defaultPlaySec, primaryArtist } from './sequencer';
import { scoreTransition, type TransitionOptions, type TransitionScore } from './transition';
import type { MixTrack } from './types';

export interface SetItem<T extends MixTrack = MixTrack> {
  track: T;
  index: number;
  startSec: number;
  playSec: number;
  /** Ønsket energi her ifølge kurven */
  targetEnergy: number;
}

export interface SetWarning {
  index: number;
  kind: 'artist' | 'recent' | 'missing';
  message: string;
}

/** Et «hull»: overgangen fra låt `index` til `index + 1` er vanskelig */
export interface Gap {
  index: number;
  reasons: string[];
}

export interface SetAnalysis<T extends MixTrack = MixTrack> {
  items: SetItem<T>[];
  transitions: TransitionScore[];
  totalSec: number;
  avgScore: number;
  gaps: Gap[];
  warnings: SetWarning[];
  /** Indeks for låten der settet topper seg (høyest energi, midt i en topp) */
  peakIndex: number | null;
}

export interface AnalysisOptions<T extends MixTrack> extends TransitionOptions {
  curve: EnergyCurve;
  playSec?: (t: T) => number;
  artistGap?: number;
  /** Dager siden sist spilt / antall ganger, for advarsel om at låten er spilt mye nylig */
  playedInfo?: (t: T) => { lastPlayedAt: string | null; playCount: number } | null;
  now?: Date;
}

export function analyzeSet<T extends MixTrack>(tracks: T[], opts: AnalysisOptions<T>): SetAnalysis<T> {
  const playSec = opts.playSec ?? defaultPlaySec;
  const artistGap = opts.artistGap ?? 3;
  const plays = tracks.map((t) => playSec(t));
  const totalSec = plays.reduce((a, b) => a + b, 0);
  let t0 = 0;
  const items = tracks.map((track, index) => {
    const startSec = t0;
    t0 += plays[index];
    return { track, index, startSec, playSec: plays[index], targetEnergy: Math.round(energyAt(opts.curve, (startSec + plays[index] / 2) / Math.max(1, totalSec)) * 10) / 10 };
  });
  const transitions = tracks.slice(1).map((b, i) => scoreTransition(tracks[i], b, opts));

  const gaps: Gap[] = transitions.flatMap((tr, i) => {
    const reasons = tr.issues.filter((x) => !x.startsWith('mangler'));
    if (tr.grade === 'bad' && !reasons.length) reasons.push(`lav score (${tr.score})`);
    return reasons.length || tr.grade === 'bad' ? [{ index: i, reasons }] : [];
  });

  const warnings: SetWarning[] = [];
  const artists = tracks.map((t) => primaryArtist(t.artist));
  tracks.forEach((t, i) => {
    for (let k = Math.max(0, i - artistGap); k < i; k++) {
      if (artists[k] && artists[k] === artists[i]) {
        warnings.push({ index: i, kind: 'artist', message: `${t.artist} også ${i - k === 1 ? 'rett før' : `${i - k} låter før`}` });
        break;
      }
    }
    if (t.bpm == null || t.camelot == null) warnings.push({ index: i, kind: 'missing', message: `mangler ${[t.bpm == null && 'BPM', t.camelot == null && 'key'].filter(Boolean).join(' og ')}` });
    const info = opts.playedInfo?.(t);
    if (info?.lastPlayedAt) {
      const days = Math.floor(((opts.now ?? new Date()).getTime() - new Date(info.lastPlayedAt).getTime()) / 86400000);
      if (days >= 0 && days <= 30) warnings.push({ index: i, kind: 'recent', message: `spilt for ${days === 0 ? 'i dag' : `${days} dager siden`}${info.playCount > 1 ? ` (${info.playCount}× totalt)` : ''}` });
    }
  });

  // Toppen: første låt med høyest energi
  let peakIndex: number | null = null;
  let bestE = -1;
  tracks.forEach((t, i) => {
    if (t.energy != null && t.energy > bestE) {
      bestE = t.energy;
      peakIndex = i;
    }
  });

  const avgScore = transitions.length ? Math.round(transitions.reduce((a, b) => a + b.score, 0) / transitions.length) : 100;
  return { items, transitions, totalSec, avgScore, gaps, warnings, peakIndex };
}
