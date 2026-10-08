import type { Track } from '../db/types';
import { camelotToMusical, parseCamelot } from '../engine/camelot';
import { href, keyRoute } from '../lib/router';
import { keyColor } from './ui';

/**
 * Camelot-hjulet (12 øverst, med klokka). Viser antall låter per key,
 * kan markere relaterte keys, tegne et sets vei, og lenke hver key til key-siden.
 */
export function CamelotWheel({
  tracks,
  counts,
  size = 300,
  selected,
  highlight,
  linkable = true,
}: {
  tracks?: Track[];
  counts?: Map<string, number>;
  size?: number;
  selected?: string;
  highlight?: string[];
  linkable?: boolean;
}) {
  const c = size / 2;
  const outerW = size * 0.13;
  const rings = { B: [c - 2, c - 2 - outerW], A: [c - 4 - outerW, c - 4 - 2 * outerW] } as const;
  const angle = (num: number) => ((num % 12) * 30 - 90) * (Math.PI / 180);
  const pt = (num: number, r: number) => [c + r * Math.cos(angle(num)), c + r * Math.sin(angle(num))] as const;

  const n = counts ?? new Map<string, number>();
  if (!counts && tracks) tracks.forEach((t) => t.camelot && n.set(t.camelot, (n.get(t.camelot) ?? 0) + 1));

  const sector = (num: number, r1: number, r2: number) => {
    const a0 = angle(num) - Math.PI / 12 + 0.014;
    const a1 = angle(num) + Math.PI / 12 - 0.014;
    const p = (a: number, r: number) => `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`;
    return `M${p(a0, r1)} A${r1},${r1} 0 0 1 ${p(a1, r1)} L${p(a1, r2)} A${r2},${r2} 0 0 0 ${p(a0, r2)} Z`;
  };

  const path = (tracks ?? [])
    .map((t) => (t.camelot ? parseCamelot(t.camelot) : null))
    .filter((k): k is NonNullable<typeof k> => !!k)
    .map((k) => {
      const [r1, r2] = rings[k.letter];
      return pt(k.num, (r1 + r2) / 2);
    });
  const showPath = !counts && path.length > 0;
  const fs = Math.max(9, Math.round(size / 26));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Camelot wheel" className="max-w-full">
      {(['B', 'A'] as const).flatMap((letter) =>
        Array.from({ length: 12 }, (_, i) => {
          const num = i + 1;
          const key = `${num}${letter}`;
          const count = n.get(key) ?? 0;
          const [r1, r2] = rings[letter];
          const [tx, ty] = pt(num, (r1 + r2) / 2);
          const isSel = selected === key;
          const isHi = highlight?.includes(key);
          const strong = isSel || isHi || count > 0;
          const seg = (
            <g key={key} className={linkable ? 'cursor-pointer transition hover:brightness-125' : undefined}>
              <path d={sector(num, r1, r2)} fill={keyColor(key)} opacity={isSel ? 1 : isHi ? 0.85 : count ? 0.8 : 0.18} stroke={isSel ? '#f3efe7' : 'none'} strokeWidth={isSel ? 2 : 0}>
                <title>{`${key} · ${camelotToMusical(key)}${counts || tracks ? ` — ${count} track${count === 1 ? '' : 's'}` : ''}`}</title>
              </path>
              <text x={tx} y={ty + (counts && count ? -1 : fs / 3)} fontSize={fs} fontWeight={strong ? 600 : 400} fill={strong ? '#fff' : '#bfb9ad'} opacity={strong ? 1 : 0.6} textAnchor="middle" pointerEvents="none">
                {key}
              </text>
              {counts && count > 0 && (
                <text x={tx} y={ty + fs} fontSize={fs - 2} fill="#fff" opacity={0.85} textAnchor="middle" pointerEvents="none">
                  {count}
                </text>
              )}
            </g>
          );
          return linkable ? (
            <a key={key} href={href(keyRoute(key))} aria-label={`${key}, ${camelotToMusical(key)}${count ? `, ${count} tracks` : ''}`}>
              {seg}
            </a>
          ) : (
            seg
          );
        }),
      )}
      {showPath &&
        path.slice(1).map(([x2, y2], i) => {
          const [x1, y1] = path[i];
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f3efe7" strokeWidth={2} strokeLinecap="round" opacity={0.3 + (0.6 * (i + 1)) / path.length} pointerEvents="none" />;
        })}
      {showPath && (
        <g pointerEvents="none">
          <circle cx={path[0][0]} cy={path[0][1]} r={8} fill="#0e0d0c" stroke="#f3efe7" strokeWidth={2} />
          <text x={path[0][0]} y={path[0][1] + 3.5} fontSize={9} fontWeight={700} fill="#f3efe7" textAnchor="middle">
            1
          </text>
          {path.length > 1 && (
            <>
              <circle cx={path[path.length - 1][0]} cy={path[path.length - 1][1]} r={9} fill="#f3efe7" stroke="#0e0d0c" strokeWidth={2} />
              <text x={path[path.length - 1][0]} y={path[path.length - 1][1] + 3.5} fontSize={9} fontWeight={700} fill="#0e0d0c" textAnchor="middle">
                {path.length}
              </text>
            </>
          )}
        </g>
      )}
      <text x={c} y={c - 3} fontSize={11} fill="#8f897e" textAnchor="middle" pointerEvents="none">
        B = major
      </text>
      <text x={c} y={c + 12} fontSize={11} fill="#8f897e" textAnchor="middle" pointerEvents="none">
        A = minor
      </text>
    </svg>
  );
}
