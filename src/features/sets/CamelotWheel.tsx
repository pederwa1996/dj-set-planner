import type { Track } from '../../db/types';
import { camelotToMusical, parseCamelot } from '../../engine/camelot';
import { keyColor } from '../../components/ui';

/** Camelot-hjulet med settets vei gjennom keyene (12 øverst, med klokka). */
export function CamelotWheel({ tracks, size = 280 }: { tracks: Track[]; size?: number }) {
  const c = size / 2;
  const rings = { B: [c - 4, c - 40], A: [c - 42, c - 78] } as const;
  const angle = (num: number) => ((num % 12) * 30 - 90) * (Math.PI / 180);
  const pt = (num: number, r: number) => [c + r * Math.cos(angle(num)), c + r * Math.sin(angle(num))] as const;

  const counts = new Map<string, number>();
  tracks.forEach((t) => t.camelot && counts.set(t.camelot, (counts.get(t.camelot) ?? 0) + 1));

  const sector = (num: number, r1: number, r2: number) => {
    const a0 = angle(num) - Math.PI / 12 + 0.012;
    const a1 = angle(num) + Math.PI / 12 - 0.012;
    const p = (a: number, r: number) => `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`;
    return `M${p(a0, r1)} A${r1},${r1} 0 0 1 ${p(a1, r1)} L${p(a1, r2)} A${r2},${r2} 0 0 0 ${p(a0, r2)} Z`;
  };

  const path = tracks
    .map((t) => (t.camelot ? parseCamelot(t.camelot) : null))
    .filter((k): k is NonNullable<typeof k> => !!k)
    .map((k) => {
      const [r1, r2] = rings[k.letter];
      return pt(k.num, (r1 + r2) / 2);
    });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Camelot-hjul med settets vei">
      {(['B', 'A'] as const).flatMap((letter) =>
        Array.from({ length: 12 }, (_, i) => {
          const num = i + 1;
          const key = `${num}${letter}`;
          const n = counts.get(key) ?? 0;
          const [r1, r2] = rings[letter];
          const [tx, ty] = pt(num, (r1 + r2) / 2);
          return (
            <g key={key}>
              <path d={sector(num, r1, r2)} fill={keyColor(key)} opacity={n ? 0.95 : 0.22}>
                <title>{`${key} · ${camelotToMusical(key)}${n ? ` — ${n} låt${n > 1 ? 'er' : ''}` : ''}`}</title>
              </path>
              <text x={tx} y={ty + 4} fontSize={11} fontWeight={n ? 700 : 400} fill={n ? '#fff' : '#cbd5e1'} textAnchor="middle" pointerEvents="none" opacity={n ? 1 : 0.7}>
                {key}
              </text>
            </g>
          );
        }),
      )}
      {path.length > 1 &&
        path.slice(1).map(([x2, y2], i) => {
          const [x1, y1] = path[i];
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f8fafc" strokeWidth={2} strokeLinecap="round" opacity={0.35 + (0.6 * (i + 1)) / path.length} />;
        })}
      {path.length > 0 && (
        <>
          <circle cx={path[0][0]} cy={path[0][1]} r={7} fill="#0b0d12" stroke="#f8fafc" strokeWidth={2} />
          <text x={path[0][0]} y={path[0][1] + 3.5} fontSize={9} fontWeight={700} fill="#f8fafc" textAnchor="middle">
            1
          </text>
          {path.length > 1 && (
            <>
              <circle cx={path[path.length - 1][0]} cy={path[path.length - 1][1]} r={8} fill="#f8fafc" stroke="#0b0d12" strokeWidth={2} />
              <text x={path[path.length - 1][0]} y={path[path.length - 1][1] + 3.5} fontSize={9} fontWeight={700} fill="#0b0d12" textAnchor="middle">
                {path.length}
              </text>
            </>
          )}
        </>
      )}
      <text x={c} y={c - 4} fontSize={11} fill="#8b93a7" textAnchor="middle">
        B = dur (ytre)
      </text>
      <text x={c} y={c + 12} fontSize={11} fill="#8b93a7" textAnchor="middle">
        A = moll (indre)
      </text>
    </svg>
  );
}
