/** Energikurver: ønsket energi (1–10) som funksjon av posisjon i settet (0–1). */
export interface CurvePoint {
  t: number; // 0–1
  e: number; // 1–10
}

export type CurvePreset = 'build' | 'warmup-peak-close' | 'waves' | 'flat';

export interface EnergyCurve {
  preset: CurvePreset | 'custom';
  points: CurvePoint[];
}

export const CURVE_PRESETS: Record<CurvePreset, { label: string; points: CurvePoint[] }> = {
  build: { label: 'Gradvis oppbygning', points: [{ t: 0, e: 3 }, { t: 1, e: 9 }] },
  'warmup-peak-close': {
    label: 'Warm-up → peak → avslutning',
    points: [
      { t: 0, e: 3 },
      { t: 0.25, e: 5 },
      { t: 0.6, e: 8 },
      { t: 0.8, e: 9 },
      { t: 1, e: 6 },
    ],
  },
  waves: {
    label: 'Bølger',
    points: [
      { t: 0, e: 4 },
      { t: 0.2, e: 7 },
      { t: 0.35, e: 5 },
      { t: 0.55, e: 8 },
      { t: 0.7, e: 6 },
      { t: 0.9, e: 9 },
      { t: 1, e: 7 },
    ],
  },
  flat: { label: 'Flat', points: [{ t: 0, e: 6 }, { t: 1, e: 6 }] },
};

export function presetCurve(preset: CurvePreset): EnergyCurve {
  return { preset, points: CURVE_PRESETS[preset].points.map((p) => ({ ...p })) };
}

/** Lineær interpolasjon mellom punktene */
export function energyAt(curve: EnergyCurve, t: number): number {
  const pts = [...curve.points].sort((a, b) => a.t - b.t);
  if (!pts.length) return 5;
  const x = Math.min(1, Math.max(0, t));
  if (x <= pts[0].t) return pts[0].e;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    if (x <= q.t) return q.t === p.t ? q.e : p.e + ((x - p.t) / (q.t - p.t)) * (q.e - p.e);
  }
  return pts[pts.length - 1].e;
}
