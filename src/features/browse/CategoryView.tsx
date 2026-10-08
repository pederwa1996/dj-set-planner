import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Globe, ListPlus, Search } from 'lucide-react';
import { db } from '../../db/db';
import type { Track } from '../../db/types';
import { CamelotWheel } from '../../components/CamelotWheel';
import { TrackRow } from '../../components/TrackRow';
import { Button, EmptyState, KeyBadge, PageHeader, Segmented } from '../../components/ui';
import { normalizeText } from '../../lib/normalize';
import { href, type CategoryKind } from '../../lib/router';
import { startBulkLookup, useBulkLookup } from '../../sources/bulkStore';
import { AddToSetDialog } from '../sets/AddToSetDialog';
import { categoryTitle, KIND_LABEL, matchesCategory, relatedKeys } from './categories';

type SortBy = 'bpm' | 'energy' | 'artist' | 'key';

function sortTracks(ts: Track[], by: SortBy): Track[] {
  const n = (v: number | null) => (v == null ? Infinity : v);
  return [...ts].sort((a, b) => {
    if (by === 'bpm') return n(a.bpm) - n(b.bpm);
    if (by === 'energy') return n(a.energy) - n(b.energy) || n(a.bpm) - n(b.bpm);
    if (by === 'key') return (a.camelot ?? 'zz').localeCompare(b.camelot ?? 'zz', 'en', { numeric: true }) || n(a.bpm) - n(b.bpm);
    return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
  });
}

export function CategoryView({ kind, value }: { kind: CategoryKind; value: string }) {
  const tracks = useLiveQuery(() => db.tracks.toArray(), []);
  const [status, setStatus] = useState<'all' | 'owned' | 'wishlist'>('all');
  const [sortBy, setSortBy] = useState<SortBy>(kind === 'bpm' || kind === 'key' ? 'energy' : 'bpm');
  const [q, setQ] = useState('');
  const [withCompatible, setWithCompatible] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const bulk = useBulkLookup();

  const related = useMemo(() => (kind === 'key' ? relatedKeys(value) : []), [kind, value]);
  const all = tracks ?? [];
  const inCat = useMemo(() => {
    const keys = kind === 'key' && withCompatible ? new Set([value, ...related.map((r) => r.camelot)]) : null;
    return all.filter((t) => (keys ? !!t.camelot && keys.has(t.camelot) : matchesCategory(t, kind, value)));
  }, [all, kind, value, withCompatible, related]);
  const shown = useMemo(() => {
    const tokens = normalizeText(q).split(' ').filter(Boolean);
    const filtered = inCat.filter((t) => (status === 'all' || t.status === status) && (!tokens.length || tokens.every((tok) => normalizeText(`${t.artist} ${t.title} ${t.version} ${t.genre}`).includes(tok))));
    return sortTracks(filtered, sortBy);
  }, [inCat, status, q, sortBy]);

  if (!tracks) return null;

  const bpms = inCat.map((t) => t.bpm).filter((b): b is number => b != null);
  const owned = inCat.filter((t) => t.status === 'owned').length;
  const countKey = (k: string) => all.filter((t) => t.camelot === k).length;
  const title = categoryTitle(kind, value);

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1 text-[13px] text-muted">
        <a href={href({ name: 'browse' })} className="hover:text-ink">
          Browse
        </a>
        <ChevronRight size={14} />
        <span>{KIND_LABEL[kind]}</span>
      </nav>
      <PageHeader
        title={title}
        subtitle={
          <>
            {inCat.length} track{inCat.length === 1 ? '' : 's'}
            {inCat.length > 0 && ` · ${owned} owned, ${inCat.length - owned} to get`}
            {bpms.length > 0 && ` · ${Math.round(Math.min(...bpms))}–${Math.round(Math.max(...bpms))} BPM`}
          </>
        }
        actions={
          <>
            {kind === 'attention' && value === 'missing' && (
              <Button onClick={() => startBulkLookup(inCat.map((t) => t.id))} disabled={bulk.running || !inCat.length}>
                <Globe size={16} /> Look up online
              </Button>
            )}
            <Button variant="primary" onClick={() => setAddOpen(true)} disabled={!shown.length}>
              <ListPlus size={16} /> Add {shown.length} to a set
            </Button>
          </>
        }
      />

      {kind === 'key' && (
        <div className="card grid grid-cols-1 items-center gap-6 p-5 md:grid-cols-[auto_minmax(0,1fr)]">
          <div className="mx-auto">
            <CamelotWheel size={240} selected={value} highlight={related.map((r) => r.camelot)} counts={new Map([[value, countKey(value)], ...related.map((r) => [r.camelot, countKey(r.camelot)] as [string, number])])} />
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-sm font-medium">Mixes well with</div>
              <p className="text-[13px] text-muted">Harmonic neighbours on the Camelot wheel. Tap one to jump to it.</p>
            </div>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {related.map((r) => (
                <li key={r.camelot}>
                  <a href={href({ name: 'category', kind: 'key', value: r.camelot })} className="flex min-h-11 items-center gap-3 rounded-xl px-3 transition hover:bg-raised">
                    <KeyBadge camelot={r.camelot} link={false} />
                    <span className="flex-1 text-[13px] text-ink2">{r.label}</span>
                    <span className="text-sm tabular-nums text-muted">{countKey(r.camelot)}</span>
                  </a>
                </li>
              ))}
            </ul>
            <label className="flex min-h-10 items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-[#d97757]" checked={withCompatible} onChange={(e) => setWithCompatible(e.target.checked)} />
              Show compatible keys in the list too
            </label>
          </div>
        </div>
      )}

      {inCat.length === 0 ? (
        <EmptyState title="No tracks here yet">Nothing in your library matches {title}.</EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-56">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input type="search" className="input w-full pl-10" placeholder={`Search in ${title}`} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Segmented
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'All' },
                { value: 'owned', label: 'Owned' },
                { value: 'wishlist', label: 'To get' },
              ]}
            />
            <label className="flex items-center gap-2 text-[13px] text-muted">
              Sort
              <select className="input min-h-10 py-1" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
                <option value="bpm">BPM</option>
                <option value="energy">Energy</option>
                <option value="key">Key</option>
                <option value="artist">Artist</option>
              </select>
            </label>
          </div>
          <div className="card divide-y divide-line/60 p-2">
            {shown.map((t) => (
              <TrackRow key={t.id} t={t} />
            ))}
            {!shown.length && <p className="p-6 text-center text-sm text-muted">No tracks match.</p>}
          </div>
        </div>
      )}

      <AddToSetDialog open={addOpen} onClose={() => setAddOpen(false)} trackIds={shown.map((t) => t.id)} defaultName={title} />
    </div>
  );
}
