import { useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertCircle, ArrowRight, CalendarDays, Cloud, CloudOff, Compass, Download, Gauge, Globe, KeyRound, ListMusic, Plus, Sparkles, Upload } from 'lucide-react';
import { db } from '../../db/db';
import type { DjSet, Track } from '../../db/types';
import { addTracks } from '../../db/tracks';
import { createSet, playSecFor } from '../../db/sets';
import { analyzeSet } from '../../engine/analysis';
import { Logo } from '../../components/Logo';
import { TrackRow } from '../../components/TrackRow';
import { Button, fmtDate } from '../../components/ui';
import { formatDuration } from '../../lib/normalize';
import { href, navigate, type Route } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { openImport, openTrack } from '../../lib/uiStore';
import { startBulkLookup, useBulkLookup } from '../../sources/bulkStore';
import { needsCheck } from '../library/filter';
import { useSync } from '../../sync/syncStore';
import { SAMPLE_TRACKS } from '../library/sampleData';

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86400000);
}

function whenLabel(date: string): string {
  const d = daysUntil(date);
  if (d === 0) return 'Tonight';
  if (d === 1) return 'Tomorrow';
  if (d > 1 && d < 7) return `In ${d} days · ${new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })}`;
  if (d < 0) return `${-d} day${d === -1 ? '' : 's'} ago`;
  return fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Neste set: nærmeste med dato i dag eller senere, ellers sist endret */
function pickNextSet(sets: DjSet[]): DjSet | null {
  const upcoming = sets.filter((s) => s.date && daysUntil(s.date) >= 0).sort((a, b) => a.date!.localeCompare(b.date!));
  return upcoming[0] ?? [...sets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

function ActionCard({ icon, title, text, onClick, to }: { icon: ReactNode; title: string; text: string; onClick?: () => void; to?: Route }) {
  const cls = 'card group flex min-h-[104px] flex-col gap-2 p-4 text-left transition hover:border-[#4a4642] hover:bg-raised/40';
  const inner = (
    <>
      <span className="text-accent">{icon}</span>
      <span className="font-medium">{title}</span>
      <span className="text-[13px] leading-snug text-muted">{text}</span>
    </>
  );
  return to ? (
    <a href={href(to)} className={cls}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function AttentionRow({ icon, text, count, to, action }: { icon: ReactNode; text: string; count: number; to: Route; action?: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-1">
      <span className="text-muted">{icon}</span>
      <a href={href(to)} className="flex-1 text-sm text-ink2 hover:text-ink">
        <span className="font-medium tabular-nums text-ink">{count}</span> {text}
      </a>
      {action}
      <a href={href(to)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink" aria-label={`Show ${text}`}>
        <ArrowRight size={16} />
      </a>
    </div>
  );
}

export function HomeView() {
  const tracks = useLiveQuery(() => db.tracks.toArray(), []);
  const sets = useLiveQuery(() => db.sets.toArray(), []);
  const [settings] = useSettings();
  const bulk = useBulkLookup();
  const sync = useSync();

  const byId = useMemo(() => new Map((tracks ?? []).map((t) => [t.id, t])), [tracks]);
  const next = useMemo(() => (sets ? pickNextSet(sets) : null), [sets]);
  const nextStats = useMemo(() => {
    if (!next) return null;
    const ts = next.slots.map((s) => byId.get(s.trackId)).filter((t): t is Track => !!t);
    const a = analyzeSet(ts, { curve: next.curve, playSec: playSecFor(next), maxTempoPct: next.maxTempoPct });
    return { n: ts.length, total: a.totalSec, avg: a.avgScore, gaps: a.gaps.length, toGet: ts.filter((t) => t.status === 'wishlist').length, pool: next.poolIds.length };
  }, [next, byId]);

  if (!tracks || !sets) return null;

  const toGet = tracks.filter((t) => t.status === 'wishlist').length;
  const check = tracks.filter(needsCheck).length;
  const missing = tracks.filter((t) => t.bpm == null || t.camelot == null);
  const noEnergy = tracks.filter((t) => t.energy == null).length;
  const recent = [...tracks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const newSet = async () => {
    const s = await createSet(`New set · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`);
    navigate({ name: 'set', id: s.id });
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <header className="flex flex-col items-center gap-2 pt-4 text-center sm:pt-10">
        <div className="flex items-center gap-3">
          <Logo size={34} />
          <h1 className="serif text-[34px] leading-tight sm:text-[42px]">{greeting()}</h1>
        </div>
        <p className="text-sm text-muted">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </header>

      {tracks.length === 0 ? (
        <section className="card mx-auto flex w-full max-w-2xl flex-col gap-5 p-6">
          <div>
            <h2 className="serif text-2xl">Let’s get your first set ready</h2>
            <p className="mt-1 text-sm text-muted">No audio files needed — plan with what’s on Spotify, then download what you need.</p>
          </div>
          <ol className="flex flex-col gap-3">
            {[
              { icon: <KeyRound size={18} />, title: 'Add your GetSongBPM key', text: 'Free, gives BPM and key for most tracks.', to: { name: 'settings' } as Route },
              { icon: <Upload size={18} />, title: 'Import tracks', text: 'Paste a list or an Exportify CSV from Spotify.', onClick: () => openImport() },
              { icon: <ListMusic size={18} />, title: 'Build a set', text: 'Pick tracks and let the engine order them.', onClick: newSet },
            ].map((s, i) => {
              const body = (
                <>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-sm text-muted">{i + 1}</span>
                  <span className="flex-1">
                    <span className="block font-medium">{s.title}</span>
                    <span className="text-[13px] text-muted">{s.text}</span>
                  </span>
                  <span className="text-accent">{s.icon}</span>
                </>
              );
              return (
                <li key={s.title}>
                  {s.to ? (
                    <a href={href(s.to)} className="flex items-center gap-4 rounded-xl p-3 transition hover:bg-raised">
                      {body}
                    </a>
                  ) : (
                    <button type="button" onClick={s.onClick} className="flex w-full items-center gap-4 rounded-xl p-3 text-left transition hover:bg-raised">
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          {sync.status === 'signed-out' && (
            <a href={href({ name: 'settings' })} className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm transition hover:bg-accent/20">
              <Cloud size={18} className="text-accent" />
              <span className="flex-1">Already set up on another device? Sign in to bring your library here.</span>
              <ArrowRight size={16} className="text-muted" />
            </a>
          )}
          <div className="border-t border-line pt-4 text-sm text-muted">
            Just looking around?{' '}
            <button type="button" className="text-accent hover:underline" onClick={() => addTracks(SAMPLE_TRACKS)}>
              Load 30 sample tracks
            </button>
          </div>
        </section>
      ) : (
        <>
          {sync.status === 'signed-out' && (
            <a href={href({ name: 'settings' })} className="card flex items-center gap-4 border-accent/30 p-4 transition hover:bg-raised/40">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <CloudOff size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Your library is only on this device</span>
                <span className="text-[13px] text-muted">Sign in to save it in the cloud and get the same tracks and sets on your phone and computer.</span>
              </span>
              <ArrowRight size={18} className="text-muted" />
            </a>
          )}

          {/* Neste set */}
          {next && nextStats ? (
            <a href={href({ name: 'set', id: next.id })} className="card group flex flex-col gap-4 p-5 transition hover:border-[#4a4642] sm:p-6">
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <CalendarDays size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-muted">{next.date ? whenLabel(next.date) : 'Last edited set'}</div>
                  <div className="serif truncate text-2xl">{next.name}</div>
                  {next.venue && <div className="text-sm text-ink2">{next.venue}</div>}
                </div>
                <ArrowRight size={20} className="mt-2 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span>
                  <span className="text-muted">Tracks </span>
                  <span className="tabular-nums">{nextStats.n}</span>
                  {nextStats.pool > nextStats.n && <span className="text-muted"> (+{nextStats.pool - nextStats.n} in pool)</span>}
                </span>
                <span>
                  <span className="text-muted">Length </span>
                  <span className="tabular-nums">{formatDuration(nextStats.total)}</span>
                  {next.targetMinutes && <span className="text-muted"> / {next.targetMinutes} min</span>}
                </span>
                {nextStats.n > 1 && (
                  <span>
                    <span className="text-muted">Flow </span>
                    <span className="tabular-nums">{nextStats.avg}</span>
                  </span>
                )}
                {nextStats.gaps > 0 && <span className="text-bad">! {nextStats.gaps} gap{nextStats.gaps === 1 ? '' : 's'}</span>}
                {nextStats.toGet > 0 && (
                  <span className="text-accent">
                    <Download size={14} className="mr-1 inline" />
                    {nextStats.toGet} to get
                  </span>
                )}
              </div>
            </a>
          ) : (
            <button type="button" onClick={newSet} className="card flex items-center gap-4 p-5 text-left transition hover:bg-raised/40">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">
                <Plus size={20} />
              </span>
              <span>
                <span className="serif block text-xl">Create your first set</span>
                <span className="text-sm text-muted">Pick tracks from your library and let the engine find the order.</span>
              </span>
            </button>
          )}

          {/* Snarveier */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ActionCard icon={<Upload size={20} />} title="Import tracks" text="Paste a list or a Spotify CSV" onClick={() => openImport()} />
            <ActionCard icon={<Plus size={20} />} title="Add a track" text="One track, with online lookup" onClick={() => openTrack(null)} />
            <ActionCard icon={<ListMusic size={20} />} title="New set" text="Start planning a set" onClick={newSet} />
            <ActionCard icon={<Compass size={20} />} title="Browse by key" text="Find tracks that mix well" to={{ name: 'browse' }} />
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* Trenger oppmerksomhet */}
            <section className="flex flex-col gap-3">
              <h2 className="serif text-xl">Needs attention</h2>
              <div className="card divide-y divide-line/60 px-4 py-1">
                {!settings.getSongBpmKey && (
                  <div className="flex min-h-12 items-center gap-3 px-1">
                    <KeyRound size={18} className="text-accent" />
                    <a href={href({ name: 'settings' })} className="flex-1 text-sm text-ink2 hover:text-ink">
                      Add your GetSongBPM key to get BPM and key automatically
                    </a>
                  </div>
                )}
                {toGet > 0 && <AttentionRow icon={<Download size={18} />} count={toGet} text={`track${toGet === 1 ? '' : 's'} to get`} to={{ name: 'category', kind: 'status', value: 'wishlist' }} />}
                {check > 0 && <AttentionRow icon={<AlertCircle size={18} />} count={check} text="uncertain lookups to check" to={{ name: 'category', kind: 'attention', value: 'check' }} />}
                {missing.length > 0 && (
                  <AttentionRow
                    icon={<Globe size={18} />}
                    count={missing.length}
                    text="missing BPM or key"
                    to={{ name: 'category', kind: 'attention', value: 'missing' }}
                    action={
                      <Button size="sm" onClick={() => startBulkLookup(missing.map((t) => t.id))} disabled={bulk.running}>
                        Look up
                      </Button>
                    }
                  />
                )}
                {noEnergy > 0 && <AttentionRow icon={<Gauge size={18} />} count={noEnergy} text="without energy level" to={{ name: 'category', kind: 'attention', value: 'energy' }} />}
                {settings.getSongBpmKey && !toGet && !check && !missing.length && !noEnergy && (
                  <div className="flex min-h-12 items-center gap-3 px-1 text-sm text-ink2">
                    <Sparkles size={18} className="text-accent" /> All caught up.
                  </div>
                )}
              </div>
            </section>

            {/* Biblioteket */}
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h2 className="serif text-xl">Recently added</h2>
                <a href={href({ name: 'library' })} className="text-[13px] text-muted hover:text-ink">
                  {tracks.length} tracks in library →
                </a>
              </div>
              <div className="card divide-y divide-line/60 p-2">
                {recent.map((t) => (
                  <TrackRow key={t.id} t={t} showGenre={false} />
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
