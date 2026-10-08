import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, Copy, Download, ListMusic, Plus, Trash2 } from 'lucide-react';
import { db } from '../../db/db';
import type { DjSet, Track } from '../../db/types';
import { createSet, deleteSet, duplicateSet, playSecFor } from '../../db/sets';
import { analyzeSet } from '../../engine/analysis';
import { Button, EmptyState, IconButton, Modal, PageHeader, fmtDate } from '../../components/ui';
import { formatDuration } from '../../lib/normalize';
import { href, navigate } from '../../lib/router';

export function SetsView() {
  const sets = useLiveQuery(() => db.sets.orderBy('updatedAt').reverse().toArray(), []);
  const tracks = useLiveQuery(() => db.tracks.toArray(), []);
  const [confirmDelete, setConfirmDelete] = useState<DjSet | null>(null);

  if (!sets || !tracks) return null;

  const byId = new Map(tracks.map((t) => [t.id, t]));
  const stats = (s: DjSet) => {
    const ts = s.slots.map((x) => byId.get(x.trackId)).filter((t): t is Track => !!t);
    const a = analyzeSet(ts, { curve: s.curve, playSec: playSecFor(s), maxTempoPct: s.maxTempoPct });
    return { n: ts.length, total: a.totalSec, avg: a.avgScore, gaps: a.gaps.length, toGet: ts.filter((t) => t.status === 'wishlist').length };
  };
  const newSet = async () => {
    const s = await createSet(`New set · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`);
    navigate({ name: 'set', id: s.id });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sets"
        subtitle={sets.length ? `${sets.length} set${sets.length === 1 ? '' : 's'}` : undefined}
        actions={
          <Button variant="primary" onClick={newSet}>
            <Plus size={16} /> New set
          </Button>
        }
      />

      {!sets.length ? (
        <EmptyState icon={<ListMusic size={28} />} title="No sets yet" actions={<Button variant="primary" onClick={newSet}><Plus size={16} /> New set</Button>}>
          Create a set, add tracks from your library to its pool, and let the engine suggest an order by key, BPM and energy curve.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sets.map((s) => {
            const st = stats(s);
            return (
              <li key={s.id} className="card group relative flex flex-col gap-3 p-5 transition hover:border-[#4a4642]">
                <a href={href({ name: 'set', id: s.id })} className="flex flex-col gap-1 after:absolute after:inset-0 after:rounded-2xl" aria-label={`Open ${s.name}`}>
                  <span className="flex items-center gap-1.5 text-[13px] text-muted">
                    <CalendarDays size={13} />
                    {s.date ? fmtDate(`${s.date}T00:00:00`, { weekday: 'short', day: 'numeric', month: 'short' }) : 'No date'}
                    {s.venue && ` · ${s.venue}`}
                  </span>
                  <span className="serif text-xl leading-snug">{s.name}</span>
                </a>
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink2">
                  <span>{st.n} tracks</span>
                  <span className="tabular-nums">
                    {formatDuration(st.total)}
                    {s.targetMinutes ? <span className="text-muted"> / {s.targetMinutes} min</span> : ''}
                  </span>
                  {st.n > 1 && <span>flow {st.avg}</span>}
                  {st.gaps > 0 && <span className="text-[#f07a7a]">! {st.gaps} gaps</span>}
                  {st.toGet > 0 && (
                    <span className="text-accent">
                      <Download size={12} className="mr-0.5 inline" />
                      {st.toGet} to get
                    </span>
                  )}
                  {s.playedAt && <span className="text-muted">played</span>}
                </p>
                <div className="relative z-10 -mb-2 -mr-2 mt-auto flex justify-end gap-1 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  <IconButton label="Duplicate" onClick={() => duplicateSet(s.id)}>
                    <Copy size={16} />
                  </IconButton>
                  <IconButton label="Delete" onClick={() => setConfirmDelete(s)} className="hover:!text-[#f07a7a]">
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete set?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await deleteSet(confirmDelete!.id);
                setConfirmDelete(null);
              }}
            >
              Delete “{confirmDelete?.name}”
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink2">The tracks stay in your library. The set can’t be recovered unless you have a backup.</p>
      </Modal>
    </div>
  );
}
