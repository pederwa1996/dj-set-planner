import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { Track } from '../../db/types';
import { TrackRow } from '../../components/TrackRow';
import { EnergyBadge, KeyBadge, Stars, StatusPill, fmtDate } from '../../components/ui';
import { formatDuration } from '../../lib/normalize';
import { href } from '../../lib/router';
import { needsCheck, type SortColumn, type SortSpec } from './filter';

/** Liten prikk når BPM/key kommer fra nett eller importert fil */
function SourceDot({ t, field }: { t: Track; field: 'bpm' | 'camelot' }) {
  const s = t.sources[field];
  if (s === 'online') return <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-tempo align-middle" title={`From online lookup: ${t.online?.sources.join(', ') ?? ''}`} />;
  if (s === 'import') return <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-muted align-middle" title="From imported file" />;
  return null;
}

export function StatusBadges({ t, isDup }: { t: Track; isDup: boolean }) {
  return (
    <>
      {isDup && (
        <span className="rounded-md bg-raised px-1.5 py-0.5 text-[11px] text-ink2" title="Same artist, title and version exists more than once">
          duplicate
        </span>
      )}
      {needsCheck(t) && (
        <span className="rounded-md bg-ok/15 px-1.5 py-0.5 text-[11px] text-ok" title={t.online?.notes.join('\n')}>
          {t.online?.status === 'notfound' ? 'not found' : 'check'}
        </span>
      )}
    </>
  );
}

const cat = (kind: 'genre' | 'tag', value: string, label: ReactNode) => (
  <a href={href({ name: 'category', kind, value })} onClick={(e) => e.stopPropagation()} className="hover:text-ink hover:underline">
    {label}
  </a>
);

export interface ColumnDef {
  id: SortColumn;
  label: string;
  className?: string;
  render: (t: Track, isDup: boolean) => ReactNode;
}

export const COLUMNS: ColumnDef[] = [
  {
    id: 'title',
    label: 'Track',
    className: 'min-w-60',
    render: (t, isDup) => (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-ink">
            {t.title}
            {t.version && <span className="text-muted"> · {t.version}</span>}
          </span>
          <StatusBadges t={t} isDup={isDup} />
        </div>
        <div className="truncate text-[13px] text-muted">{t.artist}</div>
      </div>
    ),
  },
  { id: 'artist', label: 'Artist', className: 'min-w-32', render: (t) => t.artist },
  { id: 'version', label: 'Version', className: 'min-w-28 text-ink2', render: (t) => t.version },
  {
    id: 'bpm',
    label: 'BPM',
    className: 'text-right tabular-nums',
    render: (t) =>
      t.bpm != null ? (
        <>
          {t.bpm.toFixed(t.bpm % 1 ? 1 : 0)}
          <SourceDot t={t} field="bpm" />
        </>
      ) : (
        <span className="text-muted">–</span>
      ),
  },
  {
    id: 'camelot',
    label: 'Key',
    render: (t) => (
      <span className="inline-flex items-center">
        <KeyBadge camelot={t.camelot} />
        <SourceDot t={t} field="camelot" />
      </span>
    ),
  },
  { id: 'energy', label: 'Energy', className: 'text-center', render: (t) => <EnergyBadge value={t.energy} /> },
  { id: 'genre', label: 'Genre', className: 'text-ink2', render: (t) => (t.genre ? cat('genre', t.genre, t.genre) : '') },
  { id: 'subgenre', label: 'Subgenre', className: 'text-ink2', render: (t) => (t.subgenre ? cat('genre', t.subgenre, t.subgenre) : '') },
  {
    id: 'tags',
    label: 'Tags',
    className: 'min-w-32',
    render: (t) => (
      <span className="flex flex-wrap gap-1">
        {t.tags.map((x) => (
          <a key={x} href={href({ name: 'category', kind: 'tag', value: x })} onClick={(e) => e.stopPropagation()} className="rounded-md bg-raised px-1.5 py-0.5 text-[11px] text-ink2 hover:text-ink">
            {x}
          </a>
        ))}
      </span>
    ),
  },
  { id: 'rating', label: 'Rating', render: (t) => (t.rating ? <Stars value={t.rating} size="sm" /> : '') },
  { id: 'durationSec', label: 'Time', className: 'text-right tabular-nums text-ink2', render: (t) => formatDuration(t.durationSec) },
  { id: 'label', label: 'Label', className: 'text-ink2', render: (t) => t.label },
  { id: 'year', label: 'Year', className: 'tabular-nums text-ink2', render: (t) => t.year ?? '' },
  { id: 'mood', label: 'Mood', className: 'text-ink2', render: (t) => t.mood },
  { id: 'playCount', label: 'Played', className: 'text-right tabular-nums text-ink2', render: (t) => t.playCount || '' },
  { id: 'lastPlayedAt', label: 'Last played', className: 'text-ink2', render: (t) => fmtDate(t.lastPlayedAt) },
  { id: 'status', label: 'Status', render: (t) => <StatusPill status={t.status} /> },
  { id: 'createdAt', label: 'Added', className: 'text-ink2', render: (t) => fmtDate(t.createdAt) },
];

export const DEFAULT_VISIBLE: SortColumn[] = ['title', 'bpm', 'camelot', 'energy', 'genre', 'durationSec', 'status'];

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
  const check = (id: string) => <input type="checkbox" className="h-[18px] w-[18px] accent-[#ef6a3a]" checked={selected.has(id)} onChange={() => onToggleSelect(id)} onClick={(e) => e.stopPropagation()} aria-label="Select" />;

  return (
    <>
      {/* Mobil: liste */}
      <div className="card divide-y divide-line/60 p-1.5 md:hidden">
        {rows.map((t) => (
          <TrackRow key={t.id} t={t} leading={<label className="grid h-10 w-7 shrink-0 place-items-center">{check(t.id)}</label>} badges={<StatusBadges t={t} isDup={isDup(t)} />} />
        ))}
      </div>

      {/* Desktop: tabell */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead className="text-left">
            <tr className="border-b border-line/70">
              <th className="w-12 pl-4">
                <input type="checkbox" className="h-[18px] w-[18px] accent-[#ef6a3a]" checked={allSelected} onChange={onToggleAll} aria-label="Select all" />
              </th>
              {cols.map((c) => (
                <th key={c.id} className="whitespace-nowrap p-0 font-normal" aria-sort={sort.column === c.id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <button
                    type="button"
                    onClick={() => onSort(c.id)}
                    className={`flex min-h-11 w-full items-center gap-1 px-3 text-[13px] transition hover:text-ink ${c.className?.includes('text-right') ? 'justify-end' : c.className?.includes('text-center') ? 'justify-center' : ''} ${sort.column === c.id ? 'text-ink' : 'text-muted'}`}
                  >
                    {c.label}
                    {sort.column === c.id && (sort.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} onClick={() => onOpen(t)} className={`cursor-pointer border-b border-line/40 transition last:border-0 hover:bg-raised/50 ${selected.has(t.id) ? 'bg-accent-soft' : ''}`}>
                <td className="pl-4">{check(t.id)}</td>
                {cols.map((c) => (
                  <td key={c.id} className={`max-w-[28rem] px-3 py-2.5 ${c.className ?? ''}`}>
                    {c.render(t, isDup(t))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div ref={sentinel} />
      {limit < tracks.length && <p className="py-4 text-center text-sm text-muted">Loading more…</p>}
    </>
  );
}
