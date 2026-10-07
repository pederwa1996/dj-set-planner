import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Track } from '../../db/types';
import { EnergyBadge, KeyBadge, Stars } from '../../components/ui';
import { formatDuration } from '../../lib/normalize';
import { needsCheck, type SortColumn, type SortSpec } from './filter';

/** Liten markering når BPM/key kommer fra nett, eller oppslaget må sjekkes */
function OnlineMark({ t, field }: { t: Track; field: 'bpm' | 'camelot' }) {
  if (t.sources[field] === 'online') return <span className="ml-1 text-xs text-sky-400" title={`Fra nett: ${t.online?.sources.join(', ') ?? ''}`}>●</span>;
  if (t.sources[field] === 'import') return <span className="ml-1 text-xs text-violet-400" title="Fra importert fil">●</span>;
  return null;
}

export function StatusBadges({ t, isDup }: { t: Track; isDup: boolean }) {
  return (
    <>
      {isDup && <span className="rounded bg-amber-700/60 px-1.5 py-0.5 text-xs text-amber-100" title="Samme artist, tittel og versjon finnes flere ganger">duplikat</span>}
      {needsCheck(t) && (
        <span className="rounded bg-orange-800/70 px-1.5 py-0.5 text-xs text-orange-100" title={t.online?.notes.join('\n')}>
          {t.online?.status === 'notfound' ? 'ikke funnet' : 'sjekk'}
        </span>
      )}
    </>
  );
}

export interface ColumnDef {
  id: SortColumn;
  label: string;
  className?: string;
  render: (t: Track) => ReactNode;
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('no') : '');

export const COLUMNS: ColumnDef[] = [
  { id: 'artist', label: 'Artist', className: 'min-w-36 font-medium', render: (t) => t.artist },
  { id: 'title', label: 'Tittel', className: 'min-w-44', render: (t) => t.title },
  { id: 'version', label: 'Versjon', className: 'min-w-28 text-slate-300', render: (t) => t.version },
  { id: 'bpm', label: 'BPM', className: 'text-right tabular-nums', render: (t) => (t.bpm != null ? <>{t.bpm.toFixed(t.bpm % 1 ? 2 : 0)}<OnlineMark t={t} field="bpm" /></> : '') },
  { id: 'camelot', label: 'Key', render: (t) => <span className="inline-flex items-center"><KeyBadge camelot={t.camelot} /><OnlineMark t={t} field="camelot" /></span> },
  { id: 'energy', label: 'Energi', className: 'text-center', render: (t) => <EnergyBadge value={t.energy} /> },
  { id: 'genre', label: 'Sjanger', render: (t) => t.genre },
  { id: 'subgenre', label: 'Undersjanger', render: (t) => t.subgenre },
  {
    id: 'tags',
    label: 'Tagger',
    className: 'min-w-32',
    render: (t) => (
      <span className="flex flex-wrap gap-1">
        {t.tags.map((x) => (
          <span key={x} className="rounded bg-panel2 px-1.5 py-0.5 text-xs text-slate-300">
            {x}
          </span>
        ))}
      </span>
    ),
  },
  { id: 'rating', label: 'Vurdering', render: (t) => (t.rating ? <Stars value={t.rating} size="sm" /> : '') },
  { id: 'durationSec', label: 'Lengde', className: 'text-right tabular-nums', render: (t) => formatDuration(t.durationSec) },
  { id: 'label', label: 'Label', render: (t) => t.label },
  { id: 'year', label: 'År', className: 'tabular-nums', render: (t) => t.year ?? '' },
  { id: 'mood', label: 'Stemning', render: (t) => t.mood },
  { id: 'playCount', label: 'Spilt', className: 'text-right tabular-nums', render: (t) => t.playCount || '' },
  { id: 'lastPlayedAt', label: 'Spilt sist', render: (t) => fmtDate(t.lastPlayedAt) },
  { id: 'status', label: 'Status', render: (t) => (t.status === 'wishlist' ? <span className="whitespace-nowrap text-amber-300">⬇ skaffes</span> : <span className="whitespace-nowrap text-muted">✓ har fil</span>) },
  { id: 'createdAt', label: 'Lagt til', render: (t) => fmtDate(t.createdAt) },
];

export const DEFAULT_VISIBLE: SortColumn[] = ['artist', 'title', 'version', 'bpm', 'camelot', 'energy', 'genre', 'tags', 'rating', 'durationSec', 'status'];

const PAGE = 150;

/** Viser flere rader etter hvert som du scroller, så store biblioteker holder seg raske. */
function useIncremental(total: number, resetKey: unknown) {
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => setLimit(PAGE), [resetKey]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => entries[0].isIntersecting && setLimit((l) => Math.min(total, l + PAGE)), { rootMargin: '600px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [total]);
  return { limit, sentinel };
}

export function TrackTable({
  tracks,
  visible,
  sort,
  onSort,
  onOpen,
  selected,
  onToggleSelect,
  onToggleAll,
  dupCounts,
}: {
  tracks: Track[];
  visible: SortColumn[];
  sort: SortSpec;
  onSort: (c: SortColumn) => void;
  onOpen: (t: Track) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  dupCounts: Map<string, number>;
}) {
  const { limit, sentinel } = useIncremental(tracks.length, tracks);
  const cols = COLUMNS.filter((c) => visible.includes(c.id));
  const rows = tracks.slice(0, limit);
  const allSelected = tracks.length > 0 && tracks.every((t) => selected.has(t.id));
  const isDup = (t: Track) => (dupCounts.get(t.dupKey) ?? 0) > 1;

  return (
    <>
      {/* Mobil: kort */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((t) => (
          <li key={t.id} className={`flex items-stretch gap-2 rounded-xl border bg-panel ${selected.has(t.id) ? 'border-accent' : 'border-line'}`}>
            <label className="flex w-11 shrink-0 items-center justify-center">
              <input type="checkbox" className="h-5 w-5 accent-cyan-400" checked={selected.has(t.id)} onChange={() => onToggleSelect(t.id)} aria-label="Velg" />
            </label>
            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3 text-left" onClick={() => onOpen(t)}>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {t.title}
                  {t.version && <span className="text-slate-400"> ({t.version})</span>}
                </div>
                <div className="truncate text-sm text-muted">
                  {t.artist}
                  {t.genre && ` · ${t.genre}`}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                  <StatusBadges t={t} isDup={isDup(t)} />
                  {t.status === 'wishlist' && <span className="rounded bg-panel2 px-1.5 py-0.5 text-amber-300">⬇ skaffes</span>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="tabular-nums font-semibold">{t.bpm?.toFixed(t.bpm % 1 ? 1 : 0) ?? '–'}</span>
                <div className="flex items-center gap-1">
                  <KeyBadge camelot={t.camelot} showMusical={false} />
                  <EnergyBadge value={t.energy} />
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {/* Desktop: tabell */}
      <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-panel2 text-left">
            <tr>
              <th className="w-11 px-2">
                <input type="checkbox" className="h-5 w-5 accent-cyan-400" checked={allSelected} onChange={onToggleAll} aria-label="Velg alle" />
              </th>
              {cols.map((c) => (
                <th key={c.id} className="whitespace-nowrap p-0 font-medium">
                  <button type="button" onClick={() => onSort(c.id)} className={`flex min-h-11 w-full items-center gap-1 px-3 hover:text-accent ${sort.column === c.id ? 'text-accent' : 'text-slate-300'}`}>
                    {c.label}
                    <span className="text-xs">{sort.column === c.id ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.id}
                onClick={() => onOpen(t)}
                className={`cursor-pointer border-t border-line hover:bg-panel2 ${selected.has(t.id) ? 'bg-accent/10' : ''}`}
              >
                <td className="px-2" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="h-5 w-5 accent-cyan-400" checked={selected.has(t.id)} onChange={() => onToggleSelect(t.id)} aria-label="Velg" />
                </td>
                {cols.map((c) => (
                  <td key={c.id} className={`px-3 py-2 ${c.className ?? ''}`}>
                    {c.render(t)}
                    {c.id === 'title' && (
                      <span className="ml-2 inline-flex gap-1">
                        <StatusBadges t={t} isDup={isDup(t)} />
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div ref={sentinel} />
      {limit < tracks.length && <p className="py-4 text-center text-sm text-muted">Laster flere …</p>}
    </>
  );
}
