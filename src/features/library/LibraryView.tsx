import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Columns3, Download, Globe, KeyRound, ListPlus, Plus, Search, SlidersHorizontal, Trash2, Upload, X } from 'lucide-react';
import { db } from '../../db/db';
import type { Track } from '../../db/types';
import { addTracks, deleteTracks } from '../../db/tracks';
import { Button, Chip, EmptyState, IconButton, Modal, PageHeader, Segmented } from '../../components/ui';
import { useLocalStorage } from '../../lib/useLocalStorage';
import { useHotkeys } from '../../lib/useHotkeys';
import { href } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { anyDialogOpen, openImport, openTrack } from '../../lib/uiStore';
import { startBulkLookup, useBulkLookup } from '../../sources/bulkStore';
import { AddToSetDialog } from '../sets/AddToSetDialog';
import { collectValues, duplicateCounts, emptyFilter, filterTracks, sortTracks, type LibraryFilter, type SortColumn, type SortSpec } from './filter';
import { activeFilterChips, FilterPanel } from './FilterPanel';
import { COLUMNS, DEFAULT_VISIBLE, TrackTable } from './TrackTable';
import { SAMPLE_TRACKS } from './sampleData';

export function LibraryView() {
  const tracks = useLiveQuery(() => db.tracks.toArray(), []);
  const [filter, setFilter] = useLocalStorage<LibraryFilter>('library.filter', emptyFilter);
  const [sort, setSort] = useLocalStorage<SortSpec>('library.sort', { column: 'artist', dir: 'asc' });
  const [visible, setVisible] = useLocalStorage<SortColumn[]>('library.columns.v2', DEFAULT_VISIBLE);
  const [showFilters, setShowFilters] = useLocalStorage('library.showFilters', false);
  const [showColumns, setShowColumns] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [addToSet, setAddToSet] = useState<string[] | null>(null);
  const [bulkTag, setBulkTag] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const bulk = useBulkLookup();
  const [settings] = useSettings();

  const deferredFilter = useDeferredValue(filter);
  const all = tracks ?? [];
  const dupCounts = useMemo(() => duplicateCounts(all), [all]);
  const values = useMemo(() => collectValues(all), [all]);
  const shown = useMemo(() => sortTracks(filterTracks(all, deferredFilter, dupCounts), sort), [all, deferredFilter, dupCounts, sort]);
  const dupTotal = useMemo(() => [...dupCounts.values()].filter((n) => n > 1).reduce((a, b) => a + b, 0), [dupCounts]);
  const toGet = useMemo(() => all.filter((t) => t.status === 'wishlist').length, [all]);
  const missingIds = useMemo(() => all.filter((t) => (t.bpm == null || t.camelot == null) && !t.online).map((t) => t.id), [all]);

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
      f: () => !anyDialogOpen() && setShowFilters((v) => !v),
      Escape: () => {
        if (document.activeElement === searchRef.current) searchRef.current?.blur();
        else setSelected(new Set());
      },
    }),
    [setShowFilters],
  );
  useHotkeys(hotkeys, !confirmDelete && !addToSet);

  async function bulkUpdate(fn: (t: Track) => Partial<Track>) {
    const now = new Date().toISOString();
    await db.transaction('rw', db.tracks, async () => {
      for (const id of selectedIds) {
        const t = await db.tracks.get(id);
        if (t) await db.tracks.put({ ...t, ...fn(t), updatedAt: now });
      }
    });
  }

  if (!tracks) return null;

  const chips = activeFilterChips(filter, setFilter);
  const notices: { key: string; icon: React.ReactNode; text: React.ReactNode; action?: React.ReactNode }[] = [];
  if (!settings.getSongBpmKey && all.length)
    notices.push({
      key: 'key',
      icon: <KeyRound size={16} className="text-accent" />,
      text: 'Add your GetSongBPM key in Settings to look up BPM and key automatically.',
      action: (
        <a href={href({ name: 'settings' })} className="text-[13px] text-accent hover:underline">
          Open settings
        </a>
      ),
    });
  if (missingIds.length && !bulk.running)
    notices.push({
      key: 'missing',
      icon: <Globe size={16} className="text-tempo" />,
      text: `${missingIds.length} track${missingIds.length === 1 ? ' is' : 's are'} missing BPM or key.`,
      action: (
        <Button size="sm" onClick={() => startBulkLookup(missingIds)}>
          Look up online
        </Button>
      ),
    });
  if (dupTotal)
    notices.push({
      key: 'dup',
      icon: <Columns3 size={16} className="text-muted" />,
      text: `${dupTotal} possible duplicates.`,
      action: (
        <button type="button" className="text-[13px] text-ink2 hover:text-ink hover:underline" onClick={() => setFilter({ ...filter, onlyDuplicates: !filter.onlyDuplicates })}>
          {filter.onlyDuplicates ? 'Show all' : 'Show them'}
        </button>
      ),
    });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Library"
        subtitle={`${all.length} tracks${toGet ? ` · ${toGet} to get` : ''}`}
        actions={
          <>
            <Button onClick={() => openImport()}>
              <Upload size={16} /> Import
            </Button>
            <Button variant="primary" onClick={() => openTrack(null)}>
              <Plus size={16} /> Add track
            </Button>
          </>
        }
      />

      {all.length === 0 ? (
        <EmptyState
          title="Your library is empty"
          actions={
            <>
              <Button variant="primary" onClick={() => openImport()}>
                <Upload size={16} /> Import a list or CSV
              </Button>
              <Button onClick={() => openTrack(null)}>
                <Plus size={16} /> Add one track
              </Button>
              <Button variant="ghost" onClick={() => addTracks(SAMPLE_TRACKS)}>
                Load {SAMPLE_TRACKS.length} sample tracks
              </Button>
            </>
          }
        >
          Paste a list of “Artist - Title”, import a Spotify playlist (via an Exportify CSV), or add tracks one by one. BPM and key are looked up online.
        </EmptyState>
      ) : (
        <>
          {/* Verktøylinje */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-72">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                type="search"
                className="input w-full pl-10"
                placeholder="Search tracks, artists, tags — or a key like 8A or Am"
                value={filter.query}
                onChange={(e) => setFilter({ ...filter, query: e.target.value })}
              />
            </div>
            <Segmented
              value={filter.status}
              onChange={(status) => setFilter({ ...filter, status })}
              options={[
                { value: 'all', label: 'All' },
                { value: 'owned', label: 'Owned' },
                { value: 'wishlist', label: 'To get' },
              ]}
            />
            <Button onClick={() => setShowFilters(!showFilters)} className={showFilters || chips.length ? 'border-[#5c5752] text-ink' : ''}>
              <SlidersHorizontal size={16} /> Filters{chips.length ? ` · ${chips.length}` : ''}
            </Button>
            <IconButton label="Columns" className="hidden md:grid" onClick={() => setShowColumns(true)}>
              <Columns3 size={18} />
            </IconButton>
          </div>

          {showFilters && <FilterPanel filter={filter} onChange={setFilter} genres={values.genres} tags={values.tags} />}

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {chips.map((c) => (
                <Chip key={c.key} onRemove={c.remove}>
                  {c.label}
                </Chip>
              ))}
              <button type="button" className="px-2 text-[13px] text-muted hover:text-ink" onClick={() => setFilter({ ...emptyFilter, query: filter.query, status: filter.status })}>
                Clear all
              </button>
            </div>
          )}

          {notices.length > 0 && (
            <div className="card divide-y divide-line/60 px-4">
              {notices.map((n) => (
                <div key={n.key} className="flex min-h-12 flex-wrap items-center gap-3 py-2 text-sm text-ink2">
                  {n.icon}
                  <span className="flex-1">{n.text}</span>
                  {n.action}
                </div>
              ))}
            </div>
          )}

          {selectedIds.length > 0 && (
            <div className="sticky top-[70px] z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-raised p-2 shadow-xl shadow-black/30 lg:top-3">
              <span className="px-2 text-sm font-medium">{selectedIds.length} selected</span>
              <Button size="sm" onClick={() => setAddToSet(selectedIds)}>
                <ListPlus size={15} /> Add to set
              </Button>
              <Button size="sm" onClick={() => startBulkLookup(selectedIds)} disabled={bulk.running}>
                <Globe size={15} /> Look up
              </Button>
              <Button size="sm" onClick={() => bulkUpdate(() => ({ status: 'owned' }))}>
                <Check size={15} /> Owned
              </Button>
              <Button size="sm" onClick={() => bulkUpdate(() => ({ status: 'wishlist' }))}>
                <Download size={15} /> To get
              </Button>
              <form
                className="flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const tag = bulkTag.trim().toLowerCase();
                  if (tag) bulkUpdate((t) => ({ tags: t.tags.includes(tag) ? t.tags : [...t.tags, tag] }));
                  setBulkTag('');
                }}
              >
                <input className="input min-h-9 w-32 py-1 text-[13px]" placeholder="Add tag" aria-label="Add tag to selected" value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} />
              </form>
              <Button size="sm" variant="ghost" className="text-bad" onClick={() => setConfirmDelete(selectedIds)}>
                <Trash2 size={15} /> Delete
              </Button>
              <IconButton label="Clear selection" className="ml-auto" onClick={() => setSelected(new Set())}>
                <X size={17} />
              </IconButton>
            </div>
          )}

          {shown.length === 0 ? (
            <EmptyState title="No matches">
              Nothing matches your search and filters.{' '}
              <button type="button" className="text-accent hover:underline" onClick={() => setFilter(emptyFilter)}>
                Reset
              </button>
            </EmptyState>
          ) : (
            <>
              <TrackTable
                tracks={shown}
                visible={visible}
                sort={sort}
                onSort={onSort}
                onOpen={(t) => openTrack(t)}
                selected={selected}
                onToggleSelect={toggleSelect}
                onToggleAll={toggleAll}
                dupCounts={dupCounts}
              />
              {shown.length !== all.length && <p className="text-center text-[13px] text-muted">Showing {shown.length} of {all.length} tracks</p>}
            </>
          )}
        </>
      )}

      <AddToSetDialog open={!!addToSet} onClose={() => setAddToSet(null)} trackIds={addToSet ?? []} />

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete tracks?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await deleteTracks(confirmDelete!);
                setSelected(new Set());
                setConfirmDelete(null);
              }}
            >
              Delete {confirmDelete?.length === 1 ? 'track' : `${confirmDelete?.length} tracks`}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink2">This can’t be undone. Consider downloading a backup first (Settings).</p>
      </Modal>

      <Modal open={showColumns} onClose={() => setShowColumns(false)} title="Columns">
        <div className="grid grid-cols-2 gap-1">
          {COLUMNS.map((c) => (
            <label key={c.id} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm hover:bg-raised">
              <input
                type="checkbox"
                className="h-[18px] w-[18px] accent-[#ef6a3a]"
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
