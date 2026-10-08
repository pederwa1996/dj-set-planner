import { Sparkles } from 'lucide-react';
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
      <h3 className="text-[13px] font-medium text-ink2">{title}</h3>
      {!items.length ? (
        <p className="text-sm text-muted">No good matches.</p>
      ) : (
        items.map((c) => (
          <div key={c.track.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 text-sm hover:bg-raised">
            <span className="min-w-0 flex-1">
              {c.track.artist} – {c.track.title}
              {c.track.version && <span className="text-muted"> · {c.track.version}</span>}
            </span>
            <span className="tabular-nums text-ink2">{c.track.bpm ? Math.round(c.track.bpm) : '–'}</span>
            <KeyBadge camelot={c.track.camelot} showMusical={false} link={false} />
            <EnergyBadge value={c.track.energy} />
            <span className="w-24 text-right text-xs text-muted">
              in {c.into} · out {c.out}
            </span>
            <Button size="sm" variant="primary" onClick={() => onInsert(c.track)}>
              Insert
            </Button>
          </div>
        ))
      )}
    </section>
  );

  return (
    <Modal open={open} onClose={onClose} wide title="Find a bridge track">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-ink2">
          Between <strong className="font-medium text-ink">{from.artist} – {from.title}</strong> ({from.camelot ?? '?'}, {from.bpm ?? '?'} BPM) and <strong className="font-medium text-ink">{to.artist} – {to.title}</strong> ({to.camelot ?? '?'}, {to.bpm ?? '?'} BPM)
        </p>
        <p className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm">
          <Sparkles size={16} className="shrink-0 text-accent" />
          <span>
            <strong className="font-medium">Ideal bridge</strong> — {ideal.description}
          </span>
        </p>
        {list('From your library (owned)', owned)}
        {list('From your to-get list', wish)}
        <p className="text-xs text-muted">The score is the weaker of the two new transitions. Tracks already in the set are left out.</p>
      </div>
    </Modal>
  );
}
