import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ListPlus, Plus } from 'lucide-react';
import { db } from '../../db/db';
import { createSet, saveSet } from '../../db/sets';
import { Button, Modal, fmtDate } from '../../components/ui';
import { navigate } from '../../lib/router';

/** Legg en gruppe låter i potten til et set (eller et nytt set). */
export function AddToSetDialog({ open, onClose, trackIds, defaultName }: { open: boolean; onClose: () => void; trackIds: string[]; defaultName?: string }) {
  const sets = useLiveQuery(() => db.sets.orderBy('updatedAt').reverse().toArray(), []);
  const [done, setDone] = useState<{ id: string; name: string; added: number } | null>(null);
  const [name, setName] = useState('');

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
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const s = await createSet(name.trim() || defaultName || 'New set');
              await addTo(s.id);
            }}
          >
            <input className="input flex-1" placeholder={defaultName ? `New set: ${defaultName}` : 'New set name'} value={name} onChange={(e) => setName(e.target.value)} aria-label="New set name" />
            <Button type="submit" variant="primary">
              <Plus size={16} /> New set
            </Button>
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
