import { useRef, useState } from 'react';
import { CURVE_PRESETS, presetCurve, type CurvePreset, type EnergyCurve } from '../../engine/energy';
import { useElementWidth } from '../../lib/useElementWidth';

/** Velg en ferdig kurve, eller dra i punktene for å tegne din egen. Dobbeltklikk legger til/fjerner punkter. */
export function CurveEditor({ curve, onChange }: { curve: EnergyCurve; onChange: (c: EnergyCurve) => void }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(280);
  const [drag, setDrag] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const H = 130;
  const P = 14;
  const W = Math.max(200, width);
  const pts = [...curve.points].sort((a, b) => a.t - b.t);
  const x = (t: number) => P + t * (W - 2 * P);
  const y = (e: number) => P + (1 - (e - 1) / 9) * (H - 2 * P);
  const toData = (clientX: number, clientY: number) => {
    const box = svgRef.current!.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - box.left - P) / (W - 2 * P)));
    const e = Math.min(10, Math.max(1, 1 + 9 * (1 - (clientY - box.top - P) / (H - 2 * P))));
    return { t: Math.round(t * 100) / 100, e: Math.round(e * 2) / 2 };
  };

  const move = (ev: React.PointerEvent) => {
    if (drag == null) return;
    const d = toData(ev.clientX, ev.clientY);
    const next = pts.map((p, i) => {
      if (i !== drag) return p;
      const isEnd = i === 0 || i === pts.length - 1;
      const lo = i > 0 ? pts[i - 1].t + 0.02 : 0;
      const hi = i < pts.length - 1 ? pts[i + 1].t - 0.02 : 1;
      return { t: isEnd ? p.t : Math.min(hi, Math.max(lo, d.t)), e: d.e };
    });
    onChange({ preset: 'custom', points: next });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(CURVE_PRESETS) as CurvePreset[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(presetCurve(k))}
            className={`min-h-10 rounded-full border px-3 text-sm ${curve.preset === k ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-panel2 text-slate-200 hover:border-accent'}`}
          >
            {CURVE_PRESETS[k].label}
          </button>
        ))}
        {curve.preset === 'custom' && <span className="inline-flex min-h-10 items-center rounded-full border border-accent px-3 text-sm text-accent">Egen kurve</span>}
      </div>
      <div ref={ref} className="touch-none rounded-lg border border-line bg-panel2">
        <svg
          ref={svgRef}
          width={W}
          height={H}
          onPointerMove={move}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
          onDoubleClick={(ev) => {
            if ((ev.target as Element).tagName === 'circle') return;
            const d = toData(ev.clientX, ev.clientY);
            onChange({ preset: 'custom', points: [...pts, d].sort((a, b) => a.t - b.t) });
          }}
          role="img"
          aria-label="Energikurve"
        >
          {[1, 5, 10].map((e) => (
            <g key={e}>
              <line x1={P} x2={W - P} y1={y(e)} y2={y(e)} stroke="#2a3142" />
              <text x={P + 2} y={y(e) - 3} fontSize={10} fill="#8b93a7">
                {e}
              </text>
            </g>
          ))}
          <polyline points={pts.map((p) => `${x(p.t)},${y(p.e)}`).join(' ')} fill="none" stroke="#22d3ee" strokeWidth={2} strokeLinejoin="round" />
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={x(p.t)}
              cy={y(p.e)}
              r={drag === i ? 9 : 7}
              fill="#22d3ee"
              stroke="#141821"
              strokeWidth={2}
              style={{ cursor: 'grab' }}
              onPointerDown={(ev) => {
                (ev.target as Element).setPointerCapture?.(ev.pointerId);
                setDrag(i);
              }}
              onDoubleClick={() => {
                if (i === 0 || i === pts.length - 1) return;
                onChange({ preset: 'custom', points: pts.filter((_, k) => k !== i) });
              }}
            >
              <title>{`${Math.round(p.t * 100)} % inn i settet: energi ${p.e}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <p className="text-xs text-muted">Dra i punktene. Dobbeltklikk på tom flate for nytt punkt, på et punkt for å fjerne det.</p>
    </div>
  );
}
