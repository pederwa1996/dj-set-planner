import type { Track } from '../../db/types';
import { findBridges, idealBridge } from '../../engine/bridge';
import { Button, EnergyBadge, KeyBadge, Modal } from '../../components/ui';

export function BridgeDialog({ open, onClose, from, to, library, inSet, onInsert, maxTempoPct }: { open: boolean; onClose: () => void; from: Track | null; to: Track | null; library: Track[]; inSet: Set<string>; onInsert: (t: Track) => void; maxTempoPct: number }) {
  if (!from || !to) return null;
  const ideal = idealBridge(from, to);
  const all = findBridges(from, to, library, { exclude: inSet, limit: 30, maxTempoPct });
  const owned = all.filter((c) => c.track.status === 'owned').slice(0, 8);
  const wish = all.filter((c) => c.track.status === 'wishlist').slice(0, 8);

  const list = (title: string, items: typeof all) => (
    <section className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      {!items.length ? (
        <p className="text-sm text-muted">Ingen passende låter.</p>
      ) : (
        items.map((c) => (
          <div key={c.track.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-panel2 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1">
              {c.track.artist} – {c.track.title}
              {c.track.version && <span className="text-muted"> ({c.track.version})</span>}
            </span>
            <span className="tabular-nums">{c.track.bpm ? Math.round(c.track.bpm) : '–'}</span>
            <KeyBadge camelot={c.track.camelot} showMusical={false} />
            <EnergyBadge value={c.track.energy} />
            <span className="w-28 text-right text-xs text-muted">
              inn {c.into} · ut {c.out}
            </span>
            <Button variant="primary" className="!min-h-9" onClick={() => onInsert(c.track)}>
              Sett inn
            </Button>
          </div>
        ))
      )}
    </section>
  );

  return (
    <Modal open={open} onClose={onClose} wide title="Finn brolåt">
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          Mellom <strong>{from.artist} – {from.title}</strong> ({from.camelot ?? '?'}, {from.bpm ?? '?'} BPM) og <strong>{to.artist} – {to.title}</strong> ({to.camelot ?? '?'}, {to.bpm ?? '?'} BPM)
        </p>
        <p className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm">
          <strong>Ideell brolåt</strong> — {ideal.description}
        </p>
        {list('Fra biblioteket (har filen)', owned)}
        {list('Fra ønskelisten (må skaffes)', wish)}
        <p className="text-xs text-muted">Score er den svakeste av de to nye overgangene. Låter som allerede er i settet er utelatt.</p>
      </div>
    </Modal>
  );
}
