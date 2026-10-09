import { useEffect, useState } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import type { Track } from '../../db/types';
import { updateTrack } from '../../db/tracks';
import { ALL_CAMELOT, camelotToMusical, likelyMisreads } from '../../engine/camelot';
import { Button, KeyBadge, Modal } from '../../components/ui';
import { keyChecked, keySourceLabel } from '../../lib/keySource';
import { shopLinks } from '../../exporters/setExport';

/** Bekreft eller rett key-en på låtene i settet, én etter én. */
export function KeyCheckDialog({ open, onClose, tracks }: { open: boolean; onClose: () => void; tracks: Track[] }) {
  // Hvilke låter som vises, låses når dialogen åpnes (så de ikke forsvinner når du sjekker dem)
  const [ids, setIds] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (open) setIds(Array.from(new Set(tracks.filter((t) => !keyChecked(t)).map((t) => t.id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const byId = new Map(tracks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const rows = tracks
    .map((t, i) => ({ t, n: i + 1 }))
    .filter(({ t }) => (showAll || ids.includes(t.id)) && !seen.has(t.id) && (seen.add(t.id), true));
  const unchecked = tracks.filter((t) => !keyChecked(t));
  const total = new Set(tracks.map((t) => t.id)).size;
  const checkedCount = total - new Set(unchecked.map((t) => t.id)).size;

  const setKey = (t: Track, camelot: string | null) => updateTrack(t.id, { camelot, sources: { ...t.sources, camelot: 'manual' } });

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Check keys"
      footer={
        <>
          <span className="mr-auto text-[13px] text-ink2">
            {checkedCount} of {total} keys checked
          </span>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-sidebar/60 p-4 text-[13px] text-ink2">
          <p>
            Keys from an Exportify file are Spotify’s automatic analysis, and it’s often a little off — usually by mixing up <strong className="font-medium text-ink">major and minor</strong> (8A ↔ 8B) or by <strong className="font-medium text-ink">one step</strong> on the wheel (8A ↔ 7A or 9A). A wrong key makes the engine pick bad transitions.
          </p>
          <p className="mt-2">
            Open the track on <strong className="font-medium text-ink">Beatport</strong> (its key is usually closer for electronic music), then tap the right key below. Your choice is marked as checked and is never overwritten.
          </p>
        </div>

        <label className="flex min-h-10 items-center gap-3 self-start text-sm text-ink2">
          <input type="checkbox" className="h-[18px] w-[18px] accent-[#ef6a3a]" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show every track in the set (also the ones already checked)
        </label>

        {!rows.length ? (
          <p className="py-8 text-center text-sm text-muted">All keys in this set are checked. ✓</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map(({ t, n }) => {
              const cur = byId.get(t.id) ?? t;
              const ok = keyChecked(cur);
              const alts = likelyMisreads(cur.camelot);
              const beatport = shopLinks(cur).find((l) => l.name === 'Beatport');
              const google = `https://www.google.com/search?q=${encodeURIComponent(`${cur.artist} ${cur.title} ${cur.version} key bpm`)}`;
              return (
                <li key={t.id} className={`flex flex-col gap-2.5 rounded-2xl border p-3 ${ok ? 'border-good/40 bg-good/5' : 'border-line'}`}>
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                    <span className="w-6 shrink-0 pt-0.5 text-right text-[13px] tabular-nums text-muted">{n}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">
                        {cur.artist} – {cur.title}
                        {cur.version && <span className="text-muted"> · {cur.version}</span>}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        {ok ? (
                          <span className="text-[#5fd35f]">
                            <Check size={12} className="mr-0.5 inline" />
                            {cur.camelot} · {camelotToMusical(cur.camelot)} — {keySourceLabel(cur)}
                          </span>
                        ) : (
                          <span>
                            {cur.camelot ? `${cur.camelot} · ${camelotToMusical(cur.camelot)} — ` : ''}
                            {keySourceLabel(cur)}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="flex gap-3 text-[13px]">
                      {beatport && (
                        <a href={beatport.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                          Beatport <ExternalLink size={12} />
                        </a>
                      )}
                      <a href={google} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink2 hover:text-ink hover:underline">
                        Search <ExternalLink size={12} />
                      </a>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pl-9">
                    {cur.camelot && (
                      <button
                        type="button"
                        onClick={() => void setKey(cur, cur.camelot)}
                        aria-pressed={ok}
                        className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-[13px] transition ${ok ? 'border-good/50 bg-good/10 text-[#5fd35f]' : 'border-line text-ink hover:border-[#5c5752]'}`}
                      >
                        <Check size={14} /> <KeyBadge camelot={cur.camelot} showMusical={false} link={false} /> is right
                      </button>
                    )}
                    {alts.length > 0 && <span className="px-1 text-xs text-muted">or is it</span>}
                    {alts.map((k) => (
                      <button key={k} type="button" onClick={() => void setKey(cur, k)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-3 text-[13px] text-ink2 transition hover:border-[#5c5752] hover:text-ink" title={camelotToMusical(k)}>
                        <KeyBadge camelot={k} showMusical={false} link={false} />
                        <span className="hidden sm:inline">{camelotToMusical(k, 'short')}</span>
                      </button>
                    ))}
                    <select
                      className="input min-h-10 w-auto py-1 text-[13px]"
                      aria-label={`Other key for ${cur.title}`}
                      value=""
                      onChange={(e) => e.target.value && void setKey(cur, e.target.value)}
                    >
                      <option value="">{cur.camelot ? 'Other…' : 'Pick the key…'}</option>
                      {ALL_CAMELOT.map((c) => (
                        <option key={c} value={c}>
                          {c} · {camelotToMusical(c)}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
