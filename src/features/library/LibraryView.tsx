import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { Track } from '../../db/types';
import { addTrack, deleteTracks } from '../../db/tracks';
import { Button, Modal } from '../../components/ui';
import { useLocalStorage } from '../../lib/useLocalStorage';
import { useHotkeys } from '../../lib/useHotkeys';
import { makeDupKey } from '../../lib/normalize';
import { activeFilterCount, collectValues, duplicateCounts, emptyFilter, filterTracks, sortTracks, type LibraryFilter, type SortColumn, type SortSpec } from './filter';
import { FilterPanel } from './FilterPanel';
import { COLUMNS, DEFAULT_VISIBLE, TrackTable } from './TrackTable';
import { TrackEditor } from './TrackEditor';
import { SAMPLE_TRACKS } from './sampleData';
import { ImportDialog } from '../import/ImportDialog';
import { startBulkLookup, useBulkLookup } from '../../sources/bulkStore';
import { useSettings } from '../../lib/settings';

export function LibraryView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const tracks = useLiveQuery(() => db.tracks.toArray(), []);
  const [filter, setFilter] = useLocalStorage<LibraryFilter>('library.filter', emptyFilter);
  const [sort, setSort] = useLocalStorage<SortSpec>('library.sort', { column: 'artist', dir: 'asc' });
  const [visible, setVisible] = useLocalStorage<SortColumn[]>('library.columns', DEFAULT_VISIBLE);
  const [showFilters, setShowFilters] = useLocalStorage('library.showFilters', false);
  const [showColumns, setShowColumns] = useState(false);
  const [editing, setEditing] = useState<Track | null | undefined>(undefined); // undefined = lukket, null = ny
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [bulkTag, setBulkTag] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const bulk = useBulkLookup();
  const [settings] = useSettings();

  const deferredFilter = useDeferredValue(filter);
  const all = tracks ?? [];
  const dupCounts = useMemo(() => duplicateCounts(all), [all]);
  const values = useMemo(() => collectValues(all), [all]);
  const shown = useMemo(() => sortTracks(filterTracks(all, deferredFilter, dupCounts), sort), [all, deferredFilter, dupCounts, sort]);
  const dupTotal = useMemo(() => [...dupCounts.values()].filter((n) => n > 1).reduce((a, b) => a + b, 0), [dupCounts]);
  const wishlistCount = useMemo(() => all.filter((t) => t.status === 'wishlist').length, [all]);
  const missingIds = useMemo(() => all.filter((t) => (t.bpm == null || t.camelot == null) && !t.online).map((t) => t.id), [all]);

  const byDupKey = useMemo(() => {
    const m = new Map<string, Track[]>();
    for (const t of all) m.set(t.dupKey, [...(m.get(t.dupKey) ?? []), t]);
    return m;
  }, [all]);
  const duplicateOf = useCallback((a: string, ti: string, v: string) => byDupKey.get(makeDupKey(a, ti, v)) ?? [], [byDupKey]);

  const onSort = (column: SortColumn) =>
    setSort((s) => (s.column === column ? { column, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { column, dir: column === 'rating' || column === 'energy' || column === 'playCount' ? 'desc' : 'asc' }));

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () => setSelected((s) => (shown.every((t) => s.has(t.id)) ? new Set() : new Set(shown.map((t) => t.id))));
  const selectedIds = [...selected].filter((id) => all.some((t) => t.id === id));

  const hotkeys = useMemo(
    () => ({
      '/': () => searchRef.current?.focus(),
      n: () => setEditing(null),
      i: () => setImportOpen(true),
      f: () => setShowFilters((v) => !v),
      Escape: () => {
        if (document.activeElement === searchRef.current) searchRef.current?.blur();
        else setSelected(new Set());
      },
    }),
    [setShowFilters],
  );
  useHotkeys(hotkeys, editing === undefined && !confirmDelete && !importOpen);

  async function bulkUpdate(fn: (t: Track) => Partial<Track>) {
    const now = new Date().toISOString();
    await db.transaction('rw', db.tracks, async () => {
      for (const id of selectedIds) {
        const t = await db.tracks.get(id);
        if (t) await db.tracks.put({ ...t, ...fn(t), updatedAt: now });
      }
    });
  }

  if (!tracks) return <p className="p-6 text-muted">Laster bibliotek …</p>;

  const nFilters = activeFilterCount(filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-64">
          <input
            ref={searchRef}
            type="search"
            className="input w-full pl-10 text-base"
            placeholder="Søk artist, tittel, label, tagg … eller en key som «8A» / «Am»"
            value={filter.query}
            onChange={(e) => setFilter({ ...filter, query: e.target.value })}
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">⌕</span>
        </div>
        <Button onClick={() => setShowFilters(!showFilters)} className={nFilters ? 'border-accent text-accent' : ''}>
          Filtre{nFilters ? ` (${nFilters})` : ''} <kbd className="hidden text-xs opacity-50 lg:inline">F</kbd>
        </Button>
        <Button className="hidden md:inline-flex" onClick={() => setShowColumns(true)}>
          Kolonner
        </Button>
        <Button onClick={() => setImportOpen(true)}>
          Importer <kbd className="hidden text-xs opacity-50 lg:inline">I</kbd>
        </Button>
        <Button variant="primary" onClick={() => setEditing(null)}>
          + Ny låt <kbd className="hidden text-xs opacity-60 lg:inline">N</kbd>
        </Button>
      </div>

      {showFilters && <FilterPanel filter={filter} onChange={setFilter} genres={values.genres} tags={values.tags} />}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span>
          Viser <strong className="text-slate-200">{shown.length}</strong> av {all.length} låter
        </span>
        {wishlistCount > 0 && (
          <button type="button" className="hover:text-slate-200 hover:underline" onClick={() => setFilter({ ...filter, status: filter.status === 'wishlist' ? 'all' : 'wishlist' })}>
            ⬇ {wishlistCount} må skaffes
          </button>
        )}
        {missingIds.length > 0 && !bulk.running && (
          <button type="button" className="text-sky-300 hover:underline" onClick={() => startBulkLookup(missingIds)}>
            🌐 {missingIds.length} mangler BPM/key — hent fra nett
          </button>
        )}
        {!settings.getSongBpmKey && all.length > 0 && (
          <button type="button" className="text-amber-300 hover:underline" onClick={onOpenSettings}>
            ⚙ Legg inn GetSongBPM-nøkkel for key-data
          </button>
        )}
        {dupTotal > 0 && (
          <button type="button" className="text-amber-300 hover:underline" onClick={() => setFilter({ ...filter, onlyDuplicates: !filter.onlyDuplicates })}>
            ⚠ {dupTotal} mulige duplikater
          </button>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-accent/50 bg-panel2 p-2 shadow-lg">
          <span className="px-2 text-sm font-medium">{selectedIds.length} valgt</span>
          <Button onClick={() => startBulkLookup(selectedIds)} disabled={bulk.running}>
            🌐 Hent data fra nett
          </Button>
          <Button onClick={() => bulkUpdate(() => ({ status: 'owned' }))}>✓ Har filen</Button>
          <Button onClick={() => bulkUpdate(() => ({ status: 'wishlist' }))}>⬇ Må skaffes</Button>
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const tag = bulkTag.trim().toLowerCase();
              if (tag) bulkUpdate((t) => ({ tags: t.tags.includes(tag) ? t.tags : [...t.tags, tag] }));
              setBulkTag('');
            }}
          >
            <input className="input w-36" placeholder="Legg til tagg" value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} />
            <Button type="submit">+</Button>
          </form>
          <Button variant="danger" onClick={() => setConfirmDelete(selectedIds)}>
            Slett
          </Button>
          <Button variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            Fjern valg
          </Button>
        </div>
      )}

      {all.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-line px-6 py-16 text-center">
          <p className="text-lg">Biblioteket er tomt.</p>
          <p className="max-w-md text-muted">Lim inn en liste med «Artist - Tittel», importer en Spotify-spilleliste (via Exportify-CSV), eller registrer låter én og én. BPM og key hentes fra nett.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => setImportOpen(true)}>
              Importer liste / CSV
            </Button>
            <Button onClick={() => setEditing(null)}>+ Registrer én låt</Button>
            <Button
              onClick={async () => {
                for (const t of SAMPLE_TRACKS) await addTrack(t);
              }}
            >
              Legg inn {SAMPLE_TRACKS.length} eksempellåter
            </Button>
          </div>
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center text-muted">
          Ingen låter matcher søket/filtrene.{' '}
          <button type="button" className="text-accent hover:underline" onClick={() => setFilter(emptyFilter)}>
            Nullstill
          </button>
        </div>
      ) : (
        <TrackTable
          tracks={shown}
          visible={visible}
          sort={sort}
          onSort={onSort}
          onOpen={(t) => setEditing(t)}
          selected={selected}
          onToggleSelect={toggleSelect}
          onToggleAll={toggleAll}
          dupCounts={dupCounts}
        />
      )}

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} existing={all} genres={values.genres} tags={values.tags} />

      <TrackEditor
        open={editing !== undefined}
        track={editing ?? null}
        onClose={() => setEditing(undefined)}
        suggestions={values}
        duplicateOf={duplicateOf}
        onDelete={(t) => setConfirmDelete([t.id])}
      />

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Slette låter?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Avbryt
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await deleteTracks(confirmDelete!);
                setSelected(new Set());
                setConfirmDelete(null);
                setEditing(undefined);
              }}
            >
              Slett {confirmDelete?.length === 1 ? 'låten' : `${confirmDelete?.length} låter`}
            </Button>
          </>
        }
      >
        <p>Dette kan ikke angres. Ta gjerne en backup først (Data-menyen øverst).</p>
      </Modal>

      <Modal open={showColumns} onClose={() => setShowColumns(false)} title="Synlige kolonner">
        <div className="grid grid-cols-2 gap-2">
          {COLUMNS.map((c) => (
            <label key={c.id} className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-panel2">
              <input
                type="checkbox"
                className="h-5 w-5 accent-cyan-400"
                checked={visible.includes(c.id)}
                onChange={() => setVisible(visible.includes(c.id) ? visible.filter((x) => x !== c.id) : COLUMNS.map((x) => x.id).filter((id) => id === c.id || visible.includes(id)))}
              />
              {c.label}
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
}
