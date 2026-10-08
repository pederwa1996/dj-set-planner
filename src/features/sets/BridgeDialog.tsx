import { useEffect, useRef, useState } from 'react';
import { Globe, Loader2, Plus, Sparkles } from 'lucide-react';
import type { Track } from '../../db/types';
import { addTrack } from '../../db/tracks';
import { findBridges, idealBridge } from '../../engine/bridge';
import { Button, EnergyBadge, KeyBadge, Modal } from '../../components/ui';
import { discoverBridges, type DiscoverProgress, type WebSuggestion } from '../../sources/discover';
import { usePreview, WebTrackRow } from './webParts';

type Props = { open: boolean; onClose: () => void; from: Track | null; to: Track | null; library: Track[]; inSet: Set<string>; onInsert: (t: Track) => void; maxTempoPct: number };

export function BridgeDialog(props: Props) {
  if (!props.from || !props.to) return null;
  // Ny tilstand (og nytt nettsøk) for hver overgang
  return <BridgeDialogInner key={`${props.from.id}>${props.to.id}`} {...props} from={props.from} to={props.to} />;
}

function BridgeDialogInner({ open, onClose, from, to, library, inSet, onInsert, maxTempoPct }: Props & { from: Track; to: Track }) {
  const ideal = idealBridge(from, to);
  const all = findBridges(from, to, library, { exclude: inSet, limit: 30, maxTempoPct });
  const owned = all.filter((c) => c.track.status === 'owned').slice(0, 8);
  const wish = all.filter((c) => c.track.status === 'wishlist').slice(0, 8);

  // Nettsøk
  const [web, setWeb] = useState<{ status: 'idle' | 'running' | 'done' | 'error'; progress?: DiscoverProgress; results: WebSuggestion[]; notes: string[]; error?: string }>({ status: 'idle', results: [], notes: [] });
  const [added, setAdded] = useState<Record<string, 'library' | 'inserted'>>({});
  const ctrl = useRef<AbortController | null>(null);

  // Forhåndslytting (30 s fra Deezer)
  const preview = usePreview(open);
  useEffect(() => () => ctrl.current?.abort(), []);

  async function searchWeb() {
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    setWeb({ status: 'running', results: [], notes: [] });
    try {
      const r = await discoverBridges(from, to, library, { signal: ctrl.current.signal, maxTempoPct, onProgress: (progress) => setWeb((w) => ({ ...w, progress })) });
      setWeb({ status: 'done', results: r.suggestions, notes: r.notes });
    } catch (e) {
      setWeb({ status: 'error', results: [], notes: [], error: e instanceof Error ? e.message : String(e) });
    }
  }

  async function saveWebTrack(s: WebSuggestion, insert: boolean) {
    const t = s.track;
    const created = await addTrack({
      artist: t.artist,
      title: t.title,
      version: t.version,
      bpm: t.bpm,
      camelot: t.camelot,
      durationSec: t.durationSec,
      status: 'wishlist',
      tags: ['web find'],
      notes: `Found as a bridge between “${from.title}” and “${to.title}” (${t.reason}).`,
      sources: { ...(t.bpm ? { bpm: 'online' as const } : {}), ...(t.camelot ? { camelot: 'online' as const } : {}) },
    });
    setAdded((a) => ({ ...a, [t.id]: insert ? 'inserted' : 'library' }));
    if (insert) onInsert(created);
  }

  const list = (title: string, items: typeof all) => (
    <section className="flex flex-col gap-1">
      <h3 className="text-[13px] font-medium text-ink2">{title}</h3>
      {!items.length ? (
        <p className="text-sm text-muted">No good matches.</p>
      ) : (
        items.map((c) => (
          <div key={c.track.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 text-sm hover:bg-raised">
            <span className="min-w-0 flex-1 basis-full sm:basis-0">
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

  const p = web.progress;
  const progressText =
    !p || p.phase === 'artists'
      ? `Finding artists similar to ${from.artist} and ${to.artist}…`
      : p.phase === 'tracks'
        ? `Collecting their popular tracks… ${p.checked}/${p.total} artists`
        : `Checking BPM and key… ${p.checked}/${p.total} tracks`;

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

        {/* Fra nettet */}
        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-sidebar/60 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Globe size={16} className="text-accent" /> From the web
              </h3>
              <p className="text-[13px] text-muted">Tracks by artists similar to these two (Deezer), checked for BPM and key (GetSongBPM) and ranked the same way.</p>
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
          {web.status === 'done' && !web.results.length && <p className="text-sm text-muted">Nothing found that fits this transition. Try “Search again” later, or look manually using the ideal bridge above.</p>}
          {web.notes.map((n) => (
            <p key={n} className="text-[13px] text-ok">
              {n}
            </p>
          ))}

          {web.results.length > 0 && (
            <ul className="flex flex-col">
              {web.results.map((s) => {
                const t = s.track;
                const state = added[t.id];
                return (
                  <WebTrackRow
                    key={t.id}
                    track={t}
                    preview={preview}
                    side={
                      <>
                        <span className="tabular-nums text-ink2">{t.bpm ? Math.round(t.bpm) : '–'}</span>
                        <KeyBadge camelot={t.camelot} showMusical={false} link={false} />
                        <span className="text-right text-xs text-muted sm:w-24">
                          in {s.into} · out {s.out}
                        </span>
                        {state ? (
                          <span className="ml-auto w-28 text-right text-xs text-muted">{state === 'inserted' ? 'Inserted · to get' : 'Saved · to get'}</span>
                        ) : (
                          <span className="ml-auto flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => void saveWebTrack(s, false)} title="Save to your library as “to get”">
                              <Plus size={14} /> To get
                            </Button>
                            <Button size="sm" variant="primary" onClick={() => void saveWebTrack(s, true)}>
                              Insert
                            </Button>
                          </span>
                        )}
                      </>
                    }
                  />
                );
              })}
            </ul>
          )}
        </section>

        <p className="text-xs text-muted">The score is the weaker of the two new transitions. Tracks already in the set are left out. Web finds have no energy level yet — set it once you’ve listened.</p>
      </div>
    </Modal>
  );
}
