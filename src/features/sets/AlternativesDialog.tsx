import type { Track } from '../../db/types';
import type { SequenceResult } from '../../engine/sequencer';
import { Button, Modal } from '../../components/ui';
import { formatDuration } from '../../lib/normalize';

function Sparkline({ values }: { values: (number | null)[] }) {
  const W = 220;
  const H = 36;
  const pts = values.map((v, i) => (v == null ? null : `${(i / Math.max(1, values.length - 1)) * (W - 8) + 4},${H - 4 - ((v - 1) / 9) * (H - 8)}`)).filter(Boolean);
  return (
    <svg width={W} height={H} aria-label="Energiforløp">
      <polyline points={pts.join(' ')} fill="none" stroke="#22d3ee" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

export function AlternativesDialog({ open, onClose, results, byId, onPick, computing, targetSec }: { open: boolean; onClose: () => void; results: SequenceResult[]; byId: Map<string, Track>; onPick: (r: SequenceResult) => void; computing: boolean; targetSec: number | null }) {
  return (
    <Modal open={open} onClose={onClose} wide title="Forslag til rekkefølge">
      {computing ? (
        <p className="py-10 text-center text-muted">Regner ut rekkefølger …</p>
      ) : !results.length ? (
        <p className="py-10 text-center text-muted">Fant ingen rekkefølge. Legg til flere låter i potten.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {results.map((r, i) => {
            const ts = r.order.map((id) => byId.get(id)!).filter(Boolean);
            return (
              <div key={r.order.join()} className="flex flex-col gap-2 rounded-xl border border-line bg-panel2 p-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-base font-semibold">Alternativ {String.fromCharCode(65 + i)}</h3>
                  {i === 0 && <span className="text-xs text-accent">best totalt</span>}
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">Snittscore</dt>
                  <dd className="text-right font-semibold tabular-nums">{r.avgScore}</dd>
                  <dt className="text-muted">Svakeste overgang</dt>
                  <dd className="text-right tabular-nums">{r.minScore}</dd>
                  <dt className="text-muted">Låter</dt>
                  <dd className="text-right tabular-nums">{r.order.length}</dd>
                  <dt className="text-muted">Lengde</dt>
                  <dd className="text-right tabular-nums">
                    {formatDuration(r.totalSec)}
                    {targetSec ? <span className="text-muted"> / {formatDuration(targetSec)}</span> : null}
                  </dd>
                </dl>
                <Sparkline values={ts.map((t) => t.energy)} />
                <ol className="max-h-48 list-inside list-decimal overflow-y-auto text-xs text-slate-300">
                  {ts.map((t) => (
                    <li key={t.id} className="truncate">
                      {t.artist} – {t.title} <span className="text-muted">({t.camelot ?? '?'}, {t.bpm ? Math.round(t.bpm) : '?'})</span>
                    </li>
                  ))}
                </ol>
                <Button variant="primary" className="mt-auto" onClick={() => onPick(r)}>
                  Bruk alternativ {String.fromCharCode(65 + i)}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
