import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { DjSet, Track } from '../../db/types';
import { createSet, deleteSet, duplicateSet, playSecFor } from '../../db/sets';
import { analyzeSet } from '../../engine/analysis';
import { Button, Modal } from '../../components/ui';
import { formatDuration } from '../../lib/normalize';
import { useLocalStorage } from '../../lib/useLocalStorage';
import { SetEditor } from './SetEditor';

export function SetsView() {
  const [openId, setOpenId] = useLocalStorage<string | null>('sets.open', null);
  const sets = useLiveQuery(() => db.sets.orderBy('updatedAt').reverse().toArray(), []);
  const tracks = useLiveQuery(() => db.tracks.toArray(), []);
  const [confirmDelete, setConfirmDelete] = useState<DjSet | null>(null);

  if (openId && sets?.some((s) => s.id === openId)) return <SetEditor setId={openId} onBack={() => setOpenId(null)} />;
  if (!sets || !tracks) return <p className="p-6 text-muted">Laster …</p>;

  const byId = new Map(tracks.map((t) => [t.id, t]));
  const stats = (s: DjSet) => {
    const ts = s.slots.map((x) => byId.get(x.trackId)).filter((t): t is Track => !!t);
    const a = analyzeSet(ts, { curve: s.curve, playSec: playSecFor(s), maxTempoPct: s.maxTempoPct });
    return { n: ts.length, total: a.totalSec, avg: a.avgScore, gaps: a.gaps.length, buy: ts.filter((t) => t.status === 'wishlist').length };
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Sets</h1>
        <Button
          variant="primary"
          onClick={async () => {
            const s = await createSet(`Nytt set ${new Date().toLocaleDateString('no')}`);
            setOpenId(s.id);
          }}
        >
          ＋ Nytt set
        </Button>
      </div>

      {!sets.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-14 text-center">
          <p className="text-lg">Ingen sets ennå.</p>
          <p className="max-w-md text-muted">Lag et set, legg låter fra biblioteket i potten, og la motoren foreslå rekkefølgen etter key, BPM og energikurve.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sets.map((s) => {
            const st = stats(s);
            return (
              <li key={s.id} className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-4">
                <button type="button" className="text-left" onClick={() => setOpenId(s.id)}>
                  <h2 className="text-lg font-semibold hover:text-accent">{s.name}</h2>
                  <p className="text-sm text-muted">
                    {[s.date && new Date(s.date).toLocaleDateString('no', { weekday: 'short', day: 'numeric', month: 'short' }), s.venue].filter(Boolean).join(' · ') || 'Ingen dato'}
                  </p>
                </button>
                <p className="text-sm text-slate-300">
                  {st.n} låter · {formatDuration(st.total)}
                  {s.targetMinutes ? ` / ${s.targetMinutes} min` : ''}
                  {st.n > 1 && ` · snitt ${st.avg}`}
                  {st.gaps > 0 && <span className="text-red-300"> · ! {st.gaps} hull</span>}
                  {st.buy > 0 && <span className="text-amber-300"> · ⬇ {st.buy} må skaffes</span>}
                  {s.playedAt && <span className="text-muted"> · spilt</span>}
                </p>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => setOpenId(s.id)}>
                    Åpne
                  </Button>
                  <Button onClick={() => duplicateSet(s.id)}>Dupliser</Button>
                  <Button variant="ghost" className="ml-auto text-red-300" onClick={() => setConfirmDelete(s)}>
                    Slett
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Slette settet?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Avbryt
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await deleteSet(confirmDelete!.id);
                setConfirmDelete(null);
              }}
            >
              Slett «{confirmDelete?.name}»
            </Button>
          </>
        }
      >
        <p className="text-sm">Låtene blir liggende i biblioteket. Settet kan ikke gjenopprettes, med mindre du har en backup.</p>
      </Modal>
    </div>
  );
}
