import { harmonicCompatibility, type HarmonicResult } from './camelot';
import { tempoCompatibility, type TempoResult } from './tempo';
import type { MixTrack } from './types';

export type Grade = 'good' | 'ok' | 'bad';

export interface TransitionScore {
  score: number; // 0–100
  grade: Grade;
  harmonic: HarmonicResult | null;
  tempo: TempoResult | null;
  energyDelta: number | null;
  /** f.eks. "8A → 9A: +1 på hjulet · +2 BPM (1,6 %) · energi 6 → 7 — perfekt" */
  explanation: string;
  issues: string[];
}

export interface TransitionOptions {
  maxTempoPct?: number;
  weights?: { harmonic: number; tempo: number; energy: number };
}

const DEFAULT_WEIGHTS = { harmonic: 0.5, tempo: 0.35, energy: 0.15 };

function energyScore(d: number): number {
  const a = Math.abs(d);
  if (a <= 1) return 1;
  if (a === 2) return 0.8;
  if (a === 3) return 0.5;
  return 0.2;
}

export function verdict(score: number): string {
  if (score >= 90) return 'perfekt';
  if (score >= 75) return 'god';
  if (score >= 55) return 'ok';
  return 'vanskelig';
}

export function scoreTransition(a: MixTrack, b: MixTrack, opts: TransitionOptions = {}): TransitionScore {
  const w = opts.weights ?? DEFAULT_WEIGHTS;
  const maxPct = opts.maxTempoPct ?? 6;
  const issues: string[] = [];
  const parts: string[] = [];

  const harmonic = a.camelot && b.camelot ? harmonicCompatibility(a.camelot, b.camelot) : null;
  let h = 0.6;
  if (harmonic) {
    h = harmonic.score;
    parts.push(`${a.camelot} → ${b.camelot}: ${harmonic.label}`);
    if (harmonic.relation === 'clash') issues.push('dårlig key-overgang');
  } else {
    parts.push('ukjent key');
    issues.push('mangler key');
  }

  const tempo = a.bpm && b.bpm ? tempoCompatibility(a.bpm, b.bpm, maxPct) : null;
  let t = 0.6;
  if (tempo) {
    t = tempo.score;
    parts.push(tempo.label);
    if (Math.abs(tempo.pct) > maxPct) issues.push('stort BPM-hopp');
  } else {
    parts.push('ukjent BPM');
    issues.push('mangler BPM');
  }

  const energyDelta = a.energy != null && b.energy != null ? b.energy - a.energy : null;
  let e = 0.8;
  if (energyDelta != null) {
    e = energyScore(energyDelta);
    parts.push(`energi ${a.energy} → ${b.energy}`);
    if (Math.abs(energyDelta) >= 3) issues.push(`brått energihopp (${energyDelta > 0 ? '+' : ''}${energyDelta})`);
  }

  const score = Math.round(100 * (w.harmonic * h + w.tempo * t + w.energy * e) / (w.harmonic + w.tempo + w.energy));
  let grade: Grade = score >= 75 ? 'good' : score >= 55 ? 'ok' : 'bad';
  // En ren key-kræsj eller et for stort tempohopp er aldri «god»
  if (grade === 'good' && issues.some((i) => i === 'dårlig key-overgang' || i === 'stort BPM-hopp')) grade = 'ok';
  if (tempo && Math.abs(tempo.pct) > maxPct * 1.5) grade = 'bad';

  // Ordet følger karakteren (en nedjustert overgang skal ikke kalles «god»)
  const word = grade === 'good' ? verdict(score) : grade === 'ok' ? 'ok' : 'vanskelig';
  return { score, grade, harmonic, tempo, energyDelta, explanation: `${parts.join(' · ')} — ${word}`, issues };
}
