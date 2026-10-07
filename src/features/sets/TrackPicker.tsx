import { useMemo, useState } from 'react';
import type { Track } from '../../db/types';
import { Button, Chip, EnergyBadge, KeyBadge, Modal, NumberInput } from '../../components/ui';
import { emptyFilter, filterTracks, sortTracks, type LibraryFilter } from '../library/filter';

/** Velg låter fra biblioteket til potten for settet. */
export function TrackPicker({ open, onClose, tracks, already, onAdd, genres }: { open: boolean; onClose: () => void; tracks: Track[]; already: Set<string>; onAdd: (ids: string[]) => void; genres: string[] }) {
  const [f, setF] = useState<LibraryFilter>(emptyFilter);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const shown = useMemo(() => sortTracks(filterTracks(tracks, f), { column: 'bpm', dir: 'asc' }), [tracks, f]);
  const addable = shown.filter((t) => !already.has(t.id));
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const finish = (ids: string[]) => {
    onAdd(ids);
    setPicked(new Set());
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Legg låter i potten"
      footer={
        <>
          <Button className="mr-auto" onClick={() => finish(addable.map((t) => t.id))} disabled={!addable.length}>
            Legg til alle {addable.length} viste
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" disabled={!picked.size} onClick={() => finish([...picked])}>
            Legg til {picked.size || ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <input className="input" autoFocus type="search" placeholder="Søk artist, tittel, tagg, key …" value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">BPM</span>
          <NumberInput className="w-20" placeholder="fra" value={f.bpmMin} onChange={(v) => setF({ ...f, bpmMin: v })} />
          <NumberInput className="w-20" placeholder="til" value={f.bpmMax} onChange={(v) => setF({ ...f, bpmMax: v })} />
          {(['all', 'owned', 'wishlist'] as const).map((s) => (
            <Chip key={s} active={f.status === s} onClick={() => setF({ ...f, status: s })}>
              {s === 'all' ? 'Alle' : s === 'owned' ? '✓ Har filen' : '⬇ Må skaffes'}
            </Chip>
          ))}
        </div>
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <Chip key={g} active={f.genres.includes(g)} onClick={() => setF({ ...f, genres: f.genres.includes(g) ? f.genres.filter((x) => x !== g) : [...f.genres, g] })}>
                {g}
              </Chip>
            ))}
          </div>
        )}
        <ul className="flex max-h-[50dvh] flex-col gap-1 overflow-y-auto">
          {shown.slice(0, 400).map((t) => {
            const inPool = already.has(t.id);
            return (
              <li key={t.id}>
                <label className={`flex min-h-12 items-center gap-3 rounded-lg px-2 ${inPool ? 'opacity-40' : 'hover:bg-panel2'}`}>
                  <input type="checkbox" className="h-5 w-5 accent-cyan-400" disabled={inPool} checked={inPool || picked.has(t.id)} onChange={() => toggle(t.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {t.artist} – {t.title}
                      {t.version && <span className="text-muted"> ({t.version})</span>}
                    </span>
                    <span className="text-xs text-muted">
                      {t.genre}
                      {t.status === 'wishlist' && ' · ⬇ må skaffes'}
                      {inPool && ' · allerede i potten'}
                    </span>
                  </span>
                  <span className="w-12 text-right tabular-nums">{t.bpm ? Math.round(t.bpm) : '–'}</span>
                  <KeyBadge camelot={t.camelot} showMusical={false} />
                  <EnergyBadge value={t.energy} />
                </label>
              </li>
            );
          })}
          {!shown.length && <li className="p-4 text-center text-muted">Ingen låter matcher.</li>}
        </ul>
      </div>
    </Modal>
  );
}
