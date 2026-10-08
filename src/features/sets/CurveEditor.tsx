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
            className={`min-h-9 rounded-full border px-3 text-[13px] transition ${curve.preset === k ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line text-ink2 hover:border-[#6b6a63] hover:text-ink'}`}
          >
            {CURVE_PRESETS[k].label}
          </button>
        ))}
        {curve.preset === 'custom' && <span className="inline-flex min-h-9 items-center rounded-full border border-accent/50 bg-accent-soft px-3 text-[13px] text-accent">Custom</span>}
      </div>
      <div ref={ref} className="touch-none rounded-xl border border-line bg-sidebar">
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
          aria-label="Energy curve"
        >
          {[1, 5, 10].map((e) => (
            <g key={e}>
              <line x1={P} x2={W - P} y1={y(e)} y2={y(e)} stroke="#44433f" />
              <text x={P + 2} y={y(e) - 3} fontSize={10} fill="#9c9a91">
                {e}
              </text>
            </g>
          ))}
          <polyline points={pts.map((p) => `${x(p.t)},${y(p.e)}`).join(' ')} fill="none" stroke="#d97757" strokeWidth={2} strokeLinejoin="round" />
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={x(p.t)}
              cy={y(p.e)}
              r={drag === i ? 9 : 7}
              fill="#d97757"
              stroke="#1f1e1d"
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
              <title>{`${Math.round(p.t * 100)}% into the set: energy ${p.e}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <p className="text-xs text-muted">Drag the points. Double-click empty space to add a point, or a point to remove it.</p>
    </div>
  );
}
