import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock, ListPlus, Plus } from 'lucide-react';
import { db } from '../../db/db';
import { createSet, saveSet } from '../../db/sets';
import { Button, Modal, fmtDate } from '../../components/ui';
import { navigate } from '../../lib/router';
import { LENGTH_PRESETS, describeLength, estimateLength, getLengthDefaults, saveLengthDefaults } from './setLength';

/** Legg en gruppe låter i potten til et set (eller et nytt set). */
export function AddToSetDialog({ open, onClose, trackIds, defaultName }: { open: boolean; onClose: () => void; trackIds: string[]; defaultName?: string }) {
  const sets = useLiveQuery(() => db.sets.orderBy('updatedAt').reverse().toArray(), []);
  const [done, setDone] = useState<{ id: string; name: string; added: number } | null>(null);
  const [name, setName] = useState('');
  const [targetMinutes, setTargetMinutes] = useState<number | null>(() => getLengthDefaults().targetMinutes);
  const durations = useLiveQuery(async () => (open ? (await db.tracks.bulkGet(trackIds)).map((t) => t?.durationSec ?? null) : []), [open, trackIds]);
  useEffect(() => {
    if (open) setTargetMinutes(getLengthDefaults().targetMinutes);
  }, [open]);
  const length = { ...getLengthDefaults(), targetMinutes };
  const lengthOptions = targetMinutes != null && !LENGTH_PRESETS.includes(targetMinutes) ? [...LENGTH_PRESETS, targetMinutes].sort((a, b) => a - b) : LENGTH_PRESETS;

  const addTo = async (id: string) => {
    const s = await db.sets.get(id);
    if (!s) return;
    const before = new Set(s.poolIds);
    const added = trackIds.filter((x) => !before.has(x));
    await saveSet({ ...s, poolIds: [...s.poolIds, ...added] });
    setDone({ id, name: s.name, added: added.length });
  };

  const close = () => {
    setDone(null);
    setName('');
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title={`Add ${trackIds.length} track${trackIds.length === 1 ? '' : 's'} to a set`}>
      {done ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink2">
            Added {done.added} new track{done.added === 1 ? '' : 's'} to the pool of <strong className="text-ink">{done.name}</strong>
            {done.added < trackIds.length ? ` (${trackIds.length - done.added} were already there)` : ''}.
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                close();
                navigate({ name: 'set', id: done.id });
              }}
            >
              Open set
            </Button>
            <Button variant="ghost" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              saveLengthDefaults(length);
              const s = await createSet(name.trim() || defaultName || 'New set', length);
              await addTo(s.id);
            }}
          >
            <div className="flex flex-wrap gap-2">
              <input className="input min-w-0 flex-1 basis-48" placeholder={defaultName ? `New set: ${defaultName}` : 'New set name'} value={name} onChange={(e) => setName(e.target.value)} aria-label="New set name" />
              <select className="input w-auto" value={targetMinutes ?? 'none'} onChange={(e) => setTargetMinutes(e.target.value === 'none' ? null : Number(e.target.value))} aria-label="Set length">
                {lengthOptions.map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
                <option value="none">No limit</option>
              </select>
              <Button type="submit" variant="primary">
                <Plus size={16} /> New set
              </Button>
            </div>
            {durations && (
              <p className="flex gap-2 text-xs text-muted">
                <Clock size={13} className="mt-px shrink-0" />
                {describeLength(estimateLength(durations, length), length)}
              </p>
            )}
          </form>
          {sets && sets.length > 0 && (
            <ul className="flex flex-col gap-1">
              {sets.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => addTo(s.id)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left transition hover:bg-raised">
                    <ListPlus size={18} className="text-muted" />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="text-xs text-muted">{s.date ? fmtDate(s.date) : `${s.poolIds.length} in pool`}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
