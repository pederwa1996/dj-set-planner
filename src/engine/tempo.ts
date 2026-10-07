/**
 * Tempo-kompatibilitet mellom to låter, inkludert half-time/double-time
 * (f.eks. 87 ↔ 174 BPM regnes som samme puls).
 */
export type TempoMode = 'same' | 'half' | 'double';

export interface TempoResult {
  /** Endring i prosent fra a til b (etter half/double-justering), med fortegn */
  pct: number;
  /** Endring i BPM (etter justering), med fortegn */
  delta: number;
  mode: TempoMode;
  /** b sin BPM slik den møter a (f.eks. 87 → 174 ved double) */
  effective: number;
  score: number; // 0–1
  label: string;
}

const fmt = (n: number, d = 1) => n.toLocaleString('no', { maximumFractionDigits: d });

export function tempoCompatibility(a: number, b: number, maxPct = 6): TempoResult {
  const options: { eff: number; mode: TempoMode }[] = [
    { eff: b, mode: 'same' },
    { eff: b * 2, mode: 'half' }, // b går på halv tempo av a (174 → 87)
    { eff: b / 2, mode: 'double' }, // b går på dobbel tempo av a (87 → 174)
  ];
  const best = options.reduce((p, c) => (Math.abs(c.eff - a) < Math.abs(p.eff - a) ? c : p));
  const delta = best.eff - a;
  const pct = (delta / a) * 100;
  const ap = Math.abs(pct);

  let score: number;
  if (ap <= 0.5) score = 1;
  else if (ap <= 2) score = 0.95;
  else if (ap <= 4) score = 0.85;
  else if (ap <= maxPct) score = 0.85 - ((ap - 4) / Math.max(0.01, maxPct - 4)) * 0.25;
  else score = Math.max(0, 0.6 - (ap - maxPct) * 0.08);
  if (best.mode !== 'same') score *= 0.85;

  const sign = delta >= 0 ? '+' : '−';
  let label = ap < 0.05 ? 'samme BPM' : `${sign}${fmt(Math.abs(delta))} BPM (${fmt(ap)} %)`;
  if (best.mode !== 'same') label = `half/double-time ${fmt(a)} ↔ ${fmt(b)}${ap >= 0.05 ? `, ${label}` : ''}`;
  if (ap > maxPct) label += ' — stort tempohopp';
  return { pct, delta, mode: best.mode, effective: best.eff, score, label };
}
