import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Globe, Loader2, Sparkles, Trash2 } from 'lucide-react';
import type { Track } from '../../db/types';
import { upsertImportedTracks } from '../../db/tracks';
import { findReplacements, idealReplacement, type Replacement } from '../../engine/bridge';
import { scoreTransition } from '../../engine/transition';
import type { MixTrack } from '../../engine/types';
import { Button, EnergyBadge, KeyBadge, Modal } from '../../components/ui';
import { discoverReplacements, type DiscoverProgress, type WebTrack } from '../../sources/discover';
import { usePreview, WebTrackRow } from './webParts';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Plassen i settet som skal byttes */
  index: number | null;
  order: Track[];
  library: Track[];
  poolIds: string[];
  targetEnergy: number | null;
  maxTempoPct: number;
  onSwap: (trackId: string) => void;
  onRemove: () => void;
};

export function SwapDialog(props: Props) {
  const current = props.index != null ? props.order[props.index] : null;
  if (!current || props.index == null) return null;
  // Ny tilstand (og nytt nettsøk) for hver låt som byttes
  return <SwapDialogInner key={`${props.index}:${current.id}`} {...props} index={props.index} current={current} />;
}

/** «in 72 · out 88» – med pil opp når det er bedre enn i dag */
function Scores({ r, now }: { r: { into: number | null; out: number | null; score: number }; now: number | null }) {
  const gain = now == null ? null : r.score - now;
  return (
    <span className="flex flex-col items-end text-xs leading-tight sm:w-28">
      <span className="text-muted">{[r.into != null ? `in ${r.into}` : null, r.out != null ? `out ${r.out}` : null].filter(Boolean).join(' · ')}</span>
      {gain != null && gain > 0 && <span className="text-[#5fd35f]">▲ {gain} better</span>}
    </span>
  );
}

function SwapDialogInner({ open, onClose, index, current, order, library, poolIds, targetEnergy, maxTempoPct, onSwap, onRemove }: Props & { index: number; current: Track }) {
  const prev = index > 0 ? order[index - 1] : null;
  const next = index < order.length - 1 ? order[index + 1] : null;
  const opts = { maxTempoPct };
  const nowIn = prev ? scoreTransition(prev, current, opts).score : null;
  const nowOut = next ? scoreTransition(current, next, opts).score : null;
  const nowParts = [nowIn, nowOut].filter((n): n is number => n != null);
  const now = nowParts.length ? Math.min(...nowParts) : null;
  const ideal = idealReplacement(prev, next, targetEnergy);

  const inSet = new Set(order.map((t) => t.id));
  const pool = new Set(poolIds);
  // Samme låt (artist + tittel) som allerede er i settet, foreslås ikke
  // Samme låt (artist + tittel) bare én gang: den du eier, ellers den i potten
  const song = (t: Track) => `${t.artist}|${t.title}`.toLowerCase();
  const songsInSet = new Set(order.map(song));
  const bySong = new Map<string, Track>();
  const better = (a: Track, b: Track) => Number(a.status === 'owned') - Number(b.status === 'owned') || Number(pool.has(a.id)) - Number(pool.has(b.id));
  for (const t of library) {
    if (inSet.has(t.id) || songsInSet.has(song(t))) continue;
    const had = bySong.get(song(t));
    if (!had || better(t, had) > 0) bySong.set(song(t), t);
  }
  const candidates = [...bySong.values()];
  const reserve = findReplacements(prev, next, candidates.filter((t) => pool.has(t.id)), { ...opts, targetEnergy, limit: 6 });
  const fromLibrary = findReplacements(prev, next, candidates.filter((t) => !pool.has(t.id)), { ...opts, targetEnergy, limit: 8 });

  // Nettsøk
  const [web, setWeb] = useState<{ status: 'idle' | 'running' | 'done' | 'error'; progress?: DiscoverProgress; results: Replacement<WebTrack>[]; notes: string[]; error?: string }>({ status: 'idle', results: [], notes: [] });
  const ctrl = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const preview = usePreview(open);
  useEffect(() => () => ctrl.current?.abort(), []);

  async function searchWeb() {
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    setWeb({ status: 'running', results: [], notes: [] });
    try {
      const r = await discoverReplacements(prev, next, current, library, { signal: ctrl.current.signal, maxTempoPct, targetEnergy, onProgress: (progress) => setWeb((w) => ({ ...w, progress })) });
      setWeb({ status: 'done', results: r.suggestions, notes: r.notes });
    } catch (e) {
      setWeb({ status: 'error', results: [], notes: [], error: e instanceof Error ? e.message : String(e) });
    }
  }

  async function swapWithWeb(s: Replacement<WebTrack>) {
    const t = s.track;
    setBusy(t.id);
    try {
      const r = await upsertImportedTracks(
        [
          {
            artist: t.artist,
            title: t.title,
            version: t.version,
            bpm: t.bpm,
            camelot: t.camelot,
            durationSec: t.durationSec,
            notes: `Found on the web to replace “${current.title}” (${t.reason}).`,
            sources: { ...(t.bpm != null ? { bpm: 'online' as const } : {}), ...(t.camelot ? { camelot: 'online' as const } : {}) },
          },
        ],
        { status: 'wishlist', tags: ['web find'] },
      );
      onSwap(r.ids[0]);
    } finally {
      setBusy(null);
    }
  }

  const neighbour = (t: MixTrack & { title: string }, label: string) => (
    <span className="min-w-0">
      <span className="block text-[11px] uppercase tracking-wide text-muted">{label}</span>
      <span className="block truncate">
        {t.artist} – {t.title}
      </span>
      <span className="text-xs text-muted">
        {t.camelot ?? '?'} · {t.bpm ? Math.round(t.bpm) : '?'} BPM
      </span>
    </span>
  );

  const section = (title: string, items: Replacement<Track>[], empty: string) => (
    <section className="flex flex-col gap-1">
      <h3 className="text-[13px] font-medium text-ink2">{title}</h3>
      {!items.length ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((r) => (
            <li key={r.track.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 text-sm hover:bg-raised">
              <span className="min-w-0 flex-1 basis-full sm:basis-0">
                <span className="block truncate">
                  {r.track.artist} – {r.track.title}
                  {r.track.version && <span className="text-muted"> · {r.track.version}</span>}
                </span>
                {r.track.status === 'wishlist' && <span className="text-xs text-accent">to get</span>}
              </span>
              <span className="flex flex-1 items-center justify-end gap-3 sm:flex-none">
                <span className="tabular-nums text-ink2">{r.track.bpm ? Math.round(r.track.bpm) : '–'}</span>
                <KeyBadge camelot={r.track.camelot} showMusical={false} link={false} />
                <EnergyBadge value={r.track.energy} />
                <Scores r={r} now={now} />
                <Button size="sm" variant="primary" onClick={() => onSwap(r.track.id)}>
                  Swap
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const p = web.progress;
  const progressText =
    !p || p.phase === 'artists'
      ? 'Finding similar artists…'
      : p.phase === 'tracks'
        ? `Collecting their popular tracks… ${p.checked}/${p.total} artists`
        : `Checking BPM and key… ${p.checked}/${p.total} tracks`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={`Swap track #${index + 1}`}
      footer={
        <>
          <Button variant="ghost" className="mr-auto hover:!text-[#f07a7a]" onClick={onRemove}>
            <Trash2 size={16} /> Remove from set
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Plassen: før → denne → etter */}
        <div className="grid grid-cols-1 items-center gap-3 rounded-2xl border border-line bg-sidebar/60 p-4 text-sm sm:grid-cols-[1fr_auto_1.2fr_auto_1fr]">
          {prev ? neighbour(prev, 'Before') : <span className="hidden text-xs text-muted sm:block">Start of the set</span>}
          <ArrowRight size={16} className="hidden text-muted sm:block" />
          <span className="min-w-0 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2">
            <span className="block text-[11px] uppercase tracking-wide text-accent">Replacing</span>
            <span className="block truncate font-medium">
              {current.artist} – {current.title}
            </span>
            <span className="text-xs text-ink2">
              {current.camelot ?? '?'} · {current.bpm ? Math.round(current.bpm) : '?'} BPM{current.energy != null && ` · energy ${current.energy}`}
              {now != null && ` · now ${[nowIn != null ? `in ${nowIn}` : null, nowOut != null ? `out ${nowOut}` : null].filter(Boolean).join(' · ')}`}
            </span>
          </span>
          <ArrowRight size={16} className="hidden text-muted sm:block" />
          {next ? neighbour(next, 'After') : <span className="hidden text-xs text-muted sm:block">End of the set</span>}
        </div>

        <p className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm">
          <Sparkles size={16} className="shrink-0 text-accent" />
          <span>
            <strong className="font-medium">Best fit here</strong> — {ideal.description}
          </span>
        </p>

        {section('From this set’s reserve', reserve, 'Nothing in the reserve fits here.')}
        {section('From your library', fromLibrary, 'No good matches in your library.')}

        {/* Fra nettet */}
        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-sidebar/60 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Globe size={16} className="text-accent" /> From the web
              </h3>
              <p className="text-[13px] text-muted">Tracks by artists similar to the ones around this spot (Deezer), checked for BPM and key (GetSongBPM).</p>
            </div>
            {web.status === 'running' ? (
              <Button size="sm" variant="ghost" onClick={() => ctrl.current?.abort()}>
                Stop
              </Button>
            ) : (
              <Button size="sm" variant={web.status === 'idle' ? 'primary' : 'secondary'} onClick={searchWeb}>
                <Globe size={14} /> {web.status === 'idle' ? 'Search the web' : 'Search again'}
              </Button>
            )}
          </div>
          {web.status === 'running' && (
            <div className="flex flex-col gap-1.5 py-1">
              <span className="flex items-center gap-2 text-[13px] text-ink2">
                <Loader2 size={14} className="animate-spin" /> {progressText}
              </span>
              {p && p.total > 0 && (
                <span className="h-1 overflow-hidden rounded-full bg-line">
                  <span className="block h-1 rounded-full bg-accent transition-all" style={{ width: `${Math.round((p.checked / p.total) * 100)}%` }} />
                </span>
              )}
            </div>
          )}
          {web.status === 'error' && <p className="text-[13px] text-[#f07a7a]">Search failed: {web.error}</p>}
          {web.status === 'done' && !web.results.length && <p className="text-sm text-muted">Nothing found that fits here. Try “Search again” later, or use the best fit above to look manually.</p>}
          {web.notes.map((n) => (
            <p key={n} className="text-[13px] text-ok">
              {n}
            </p>
          ))}
          {web.results.length > 0 && (
            <ul className="flex flex-col">
              {web.results.map((s) => (
                <WebTrackRow
                  key={s.track.id}
                  track={s.track}
                  preview={preview}
                  side={
                    <>
                      <span className="tabular-nums text-ink2">{s.track.bpm ? Math.round(s.track.bpm) : '–'}</span>
                      <KeyBadge camelot={s.track.camelot} showMusical={false} link={false} />
                      <Scores r={s} now={now} />
                      <Button size="sm" variant="primary" className="ml-auto" disabled={busy === s.track.id} onClick={() => void swapWithWeb(s)}>
                        {busy === s.track.id && <Loader2 size={14} className="animate-spin" />}
                        Swap
                      </Button>
                    </>
                  }
                />
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-muted">
          Scores are the new transitions in and out of this spot{targetEnergy != null && ', with a little weight on energy near the curve’s target'}. The track you swap out stays in the reserve, and Ctrl+Z undoes. Web finds are saved to your library as “to get”.
        </p>
      </div>
    </Modal>
  );
}
