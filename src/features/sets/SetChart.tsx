import { useState } from 'react';
import type { Track } from '../../db/types';
import type { SetAnalysis } from '../../engine/analysis';
import { energyAt, type EnergyCurve } from '../../engine/energy';
import { keyColor } from '../../components/ui';
import { formatDuration } from '../../lib/normalize';
import { useElementWidth } from '../../lib/useElementWidth';
import { GRADE_STYLE } from './grade';

const ENERGY_COLOR = '#d95926';
const TARGET_COLOR = '#f0eee6';
const BPM_COLOR = '#3987e5';
const GRID = '#44433f';
const SURFACE = '#30302e';
const MUTED = '#9c9a91';

/**
 * Settet over tid: energi (søyler) mot målkurven, BPM (linje), key og overganger.
 * To paneler med felles tidsakse i stedet for én graf med to y-akser.
 */
export function SetChart({ analysis, curve, onSelect }: { analysis: SetAnalysis<Track>; curve: EnergyCurve; onSelect?: (index: number) => void }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(300);
  const [hover, setHover] = useState<number | null>(null);
  const { items, transitions, totalSec, peakIndex } = analysis;
  if (!items.length) return null;

  const L = 34;
  const R = 8;
  const W = Math.max(280, width);
  const plotW = W - L - R;
  const eTop = 22;
  const eH = 110;
  const trY = eTop + eH + 12;
  const bTop = trY + 16;
  const bH = 70;
  const kTop = bTop + bH + 10;
  const kH = 20;
  const axisY = kTop + kH + 14;
  const H = axisY + 6;

  const x = (sec: number) => L + (sec / Math.max(1, totalSec)) * plotW;
  const yE = (e: number) => eTop + eH - (e / 10) * eH;
  const bpms = items.map((i) => i.track.bpm).filter((b): b is number => b != null);
  const bMin = bpms.length ? Math.floor(Math.min(...bpms) - 2) : 100;
  const bMax = bpms.length ? Math.ceil(Math.max(...bpms) + 2) : 140;
  const yB = (b: number) => bTop + bH - ((b - bMin) / Math.max(1, bMax - bMin)) * bH;

  const curvePts = Array.from({ length: 61 }, (_, k) => `${x((k / 60) * totalSec)},${yE(energyAt(curve, k / 60))}`).join(' ');
  const tickStep = totalSec > 120 * 60 ? 30 * 60 : totalSec > 50 * 60 ? 15 * 60 : totalSec > 20 * 60 ? 5 * 60 : 60;
  const ticks = Array.from({ length: Math.floor(totalSec / tickStep) + 1 }, (_, k) => k * tickStep);

  const bpmSegments: string[] = [];
  let cur: string[] = [];
  items.forEach((it) => {
    if (it.track.bpm == null) {
      if (cur.length) bpmSegments.push(cur.join(' '));
      cur = [];
    } else cur.push(`${x(it.startSec + it.playSec / 2)},${yB(it.track.bpm)}`);
  });
  if (cur.length) bpmSegments.push(cur.join(' '));

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const sec = ((e.clientX - box.left - L) / plotW) * totalSec;
    const idx = items.findIndex((it) => sec >= it.startSec && sec < it.startSec + it.playSec);
    setHover(idx >= 0 ? idx : sec < 0 ? 0 : items.length - 1);
  };

  const h = hover != null ? items[hover] : null;
  const hTr = hover != null ? transitions[hover] : null;

  return (
    <div ref={ref} className="relative select-none">
      <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: ENERGY_COLOR }} /> Track energy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ background: TARGET_COLOR }} /> Target curve
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ background: BPM_COLOR }} /> BPM
        </span>
        <span>Transitions: ✓ good · ~ OK · ! tricky</span>
      </div>
      <svg width={W} height={H} role="img" aria-label="Chart of energy, BPM and key through the set">
        {/* Energi-panel */}
        <text x={L} y={12} fill={MUTED} fontSize={11}>
          Energy (1–10)
        </text>
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={yE(v)} y2={yE(v)} stroke={GRID} strokeWidth={1} />
            <text x={L - 6} y={yE(v) + 4} fill={MUTED} fontSize={10} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {items.map((it) => {
          if (it.track.energy == null) return null;
          const x0 = x(it.startSec) + 1;
          const x1 = x(it.startSec + it.playSec) - 1;
          const w = Math.max(1, Math.min(x1 - x0, 60));
          const cx = (x0 + x1) / 2;
          const top = yE(it.track.energy);
          const r = Math.min(4, w / 2);
          const bottom = yE(0);
          return (
            <path
              key={it.index}
              d={`M${cx - w / 2},${bottom} V${top + r} Q${cx - w / 2},${top} ${cx - w / 2 + r},${top} H${cx + w / 2 - r} Q${cx + w / 2},${top} ${cx + w / 2},${top + r} V${bottom} Z`}
              fill={ENERGY_COLOR}
              opacity={hover === null || hover === it.index ? 0.85 : 0.45}
            />
          );
        })}
        <polyline points={curvePts} fill="none" stroke={TARGET_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {peakIndex != null && items[peakIndex].track.energy != null && (
          <text x={x(items[peakIndex].startSec + items[peakIndex].playSec / 2)} y={yE(items[peakIndex].track.energy!) - 6} fill="#f5f4ee" fontSize={10} textAnchor="middle">
            peak
          </text>
        )}

        {/* Overganger */}
        {transitions.map((tr, i) => {
          const g = GRADE_STYLE[tr.grade];
          const cx = x(items[i + 1].startSec);
          return (
            <g key={i}>
              <circle cx={cx} cy={trY} r={7} fill={g.color} stroke={SURFACE} strokeWidth={2} />
              {plotW / items.length > 14 && (
                <text x={cx} y={trY + 3.5} fontSize={10} fontWeight={700} fill="#1f1e1d" textAnchor="middle">
                  {g.icon}
                </text>
              )}
            </g>
          );
        })}

        {/* BPM-panel */}
        <text x={L} y={bTop - 2} fill={MUTED} fontSize={11}>
          BPM
        </text>
        {[bMin, bMax].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={yB(v)} y2={yB(v)} stroke={GRID} strokeWidth={1} />
            <text x={L - 6} y={yB(v) + 4} fill={MUTED} fontSize={10} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {bpmSegments.map((pts, k) => (
          <polyline key={k} points={pts} fill="none" stroke={BPM_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {items.map((it) =>
          it.track.bpm == null ? null : <circle key={it.index} cx={x(it.startSec + it.playSec / 2)} cy={yB(it.track.bpm)} r={4} fill={BPM_COLOR} stroke={SURFACE} strokeWidth={2} />,
        )}

        {/* Key-stripe */}
        {items.map((it) => {
          const x0 = x(it.startSec) + 1;
          const w = Math.max(1, x(it.startSec + it.playSec) - 1 - x0);
          return (
            <g key={it.index}>
              <rect x={x0} y={kTop} width={w} height={kH} rx={3} fill={keyColor(it.track.camelot)} />
              {w > 24 && it.track.camelot && (
                <text x={x0 + w / 2} y={kTop + 14} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle">
                  {it.track.camelot}
                </text>
              )}
            </g>
          );
        })}

        {/* Tidsakse */}
        {ticks.map((s) => (
          <text key={s} x={x(s)} y={axisY} fill={MUTED} fontSize={10} textAnchor={s === 0 ? 'start' : 'middle'}>
            {s === 0 ? '0' : `${Math.round(s / 60)} min`}
          </text>
        ))}

        {h && <line x1={x(h.startSec + h.playSec / 2)} x2={x(h.startSec + h.playSec / 2)} y1={eTop} y2={kTop + kH} stroke="#f5f4ee" strokeWidth={1} opacity={0.5} />}
        <rect x={L} y={0} width={plotW} height={H} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} onClick={() => hover != null && onSelect?.(hover)} style={{ cursor: onSelect ? 'pointer' : 'default' }} />
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute z-10 w-64 rounded-xl border border-line bg-raised p-2.5 text-xs shadow-xl shadow-black/40"
          style={{ left: Math.min(Math.max(0, x(h.startSec + h.playSec / 2) - 128), W - 256), top: H - 8 }}
        >
          <div className="font-medium text-ink">
            {h.index + 1}. {h.track.artist} – {h.track.title}
          </div>
          <div className="mt-1 text-ink2">
            Starts {formatDuration(h.startSec)} · {h.track.bpm ?? '–'} BPM · {h.track.camelot ?? '–'} · energy {h.track.energy ?? '–'} (target {Math.round(h.targetEnergy)})
          </div>
          {hTr && (
            <div className="mt-1 text-ink2">
              {GRADE_STYLE[hTr.grade].icon} Next: {hTr.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
