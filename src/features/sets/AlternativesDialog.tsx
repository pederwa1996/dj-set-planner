import { Clock } from 'lucide-react';
import type { Track } from '../../db/types';
import type { SequenceResult } from '../../engine/sequencer';
import { Button, Modal } from '../../components/ui';
import { formatDuration } from '../../lib/normalize';

function Sparkline({ values }: { values: (number | null)[] }) {
  const W = 220;
  const H = 36;
  const pts = values.map((v, i) => (v == null ? null : `${(i / Math.max(1, values.length - 1)) * (W - 8) + 4},${H - 4 - ((v - 1) / 9) * (H - 8)}`)).filter(Boolean);
  return (
    <svg width={W} height={H} className="max-w-full" aria-label="Energy over the set">
      <polyline points={pts.join(' ')} fill="none" stroke="#d95926" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function AlternativesDialog({
  open,
  onClose,
  results,
  byId,
  onPick,
  computing,
  targetSec,
  poolSize,
  onUseAll,
  onChangeLength,
}: {
  open: boolean;
  onClose: () => void;
  results: SequenceResult[];
  byId: Map<string, Track>;
  onPick: (r: SequenceResult) => void;
  computing: boolean;
  targetSec: number | null;
  /** Antall låter motoren kunne velge fra */
  poolSize: number;
  onUseAll: () => void;
  onChangeLength: () => void;
}) {
  const used = results.length ? Math.max(...results.map((r) => r.order.length)) : 0;
  const leftOut = targetSec && !computing ? poolSize - used : 0;
  return (
    <Modal open={open} onClose={onClose} wide title="Suggested orders">
      {leftOut > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-sidebar/60 px-4 py-3 text-[13px] text-ink2">
          <Clock size={15} className="shrink-0 text-muted" />
          <span className="min-w-0 flex-1 basis-64">
            To fill {Math.round(targetSec! / 60)} min, the options use up to {used} of your {poolSize} tracks. The other {leftOut} stay in the pool as reserves.
          </span>
          <span className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onChangeLength}>
              Change length
            </Button>
            <Button size="sm" onClick={onUseAll}>
              Use all {poolSize} tracks
            </Button>
          </span>
        </div>
      )}
      {computing ? (
        <p className="py-12 text-center text-muted">Working out the best orders…</p>
      ) : !results.length ? (
        <p className="py-12 text-center text-muted">Couldn’t find an order. Add more tracks to the pool.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {results.map((r, i) => {
            const ts = r.order.map((id) => byId.get(id)!).filter(Boolean);
            return (
              <div key={r.order.join()} className="flex flex-col gap-3 rounded-2xl border border-line bg-sidebar/60 p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="serif text-lg">Option {String.fromCharCode(65 + i)}</h3>
                  {i === 0 && <span className="text-xs text-accent">Best overall</span>}
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">Average flow</dt>
                  <dd className="text-right tabular-nums">{r.avgScore}</dd>
                  <dt className="text-muted">Weakest transition</dt>
                  <dd className="text-right tabular-nums">{r.minScore}</dd>
                  <dt className="text-muted">Tracks</dt>
                  <dd className="text-right tabular-nums">{r.order.length}</dd>
                  <dt className="text-muted">Length</dt>
                  <dd className="text-right tabular-nums">
                    {formatDuration(r.totalSec)}
                    {targetSec ? <span className="text-muted"> / {formatDuration(targetSec)}</span> : null}
                  </dd>
                </dl>
                <Sparkline values={ts.map((t) => t.energy)} />
                <ol className="max-h-48 list-inside list-decimal overflow-y-auto text-xs text-ink2">
                  {ts.map((t) => (
                    <li key={t.id} className="truncate">
                      {t.artist} – {t.title} <span className="text-muted">({t.camelot ?? '?'}, {t.bpm ? Math.round(t.bpm) : '?'})</span>
                    </li>
                  ))}
                </ol>
                <Button variant="primary" className="mt-auto" onClick={() => onPick(r)}>
                  Use option {String.fromCharCode(65 + i)}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
