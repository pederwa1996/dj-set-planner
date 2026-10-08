import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe, Loader2, Tags, Users } from 'lucide-react';
import type { Track } from '../../db/types';
import { upsertImportedTracks } from '../../db/tracks';
import { Button, Chip, KeyBadge, Segmented } from '../../components/ui';
import { href } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { discoverForSet, setSeedArtists, suggestGenre, type DiscoverProgress, type SetDiscoverMode, type SetFit } from '../../sources/discover';
import { GRADE_STYLE } from './grade';
import { usePreview, WebTrackRow } from './webParts';

interface Run {
  status: 'idle' | 'running' | 'done' | 'error';
  progress?: DiscoverProgress;
  results: SetFit[];
  notes: string[];
  error?: string;
  /** Hva det ble søkt etter, f.eks. «trance» eller «artists like Chicane» */
  label: string;
  mode: SetDiscoverMode;
}

const listNames = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** Tilstand for «Find on the web» i «Add tracks». Ligger i TrackPicker så resultatene blir stående mens settet er åpent. */
export function useWebFinder({ open, setTracks, library, maxTempoPct, setName }: { open: boolean; setTracks: Track[]; library: Track[]; maxTempoPct: number; setName: string }) {
  const [modeChoice, setModeChoice] = useState<SetDiscoverMode | null>(null);
  const mode: SetDiscoverMode = modeChoice ?? (setTracks.length ? 'similar' : 'genre');
  const [genre, setGenre] = useState('');
  const seeds = useMemo(() => setSeedArtists(setTracks), [setTracks]);
  const suggested = useMemo(() => suggestGenre(setTracks, library), [setTracks, library]);
  const genreChips = useMemo(() => {
    const count = new Map<string, number>();
    for (const t of [...setTracks, ...setTracks, ...library]) if (t.genre?.trim()) count.set(t.genre.trim(), (count.get(t.genre.trim()) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g]) => g);
  }, [setTracks, library]);
  const [run, setRun] = useState<Run>({ status: 'idle', results: [], notes: [], label: '', mode });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const ctrl = useRef<AbortController | null>(null);
  const preview = usePreview(open);
  useEffect(() => () => ctrl.current?.abort(), []);

  const query = genre.trim() || suggested;
  const canSearch = mode === 'genre' ? !!query : seeds.length > 0;

  async function search() {
    if (!canSearch) return;
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    const label = mode === 'genre' ? query : `artists like ${listNames(seeds)}`;
    setPicked(new Set());
    setRun({ status: 'running', results: [], notes: [], label, mode });
    try {
      const r = await discoverForSet(setTracks, library, {
        mode,
        genre: query,
        maxTempoPct,
        signal: ctrl.current.signal,
        onProgress: (progress) => setRun((x) => ({ ...x, progress })),
      });
      setRun({ status: 'done', results: r.suggestions, notes: r.notes, label, mode });
    } catch (e) {
      setRun({ status: 'error', results: [], notes: [], error: e instanceof Error ? e.message : String(e), label, mode });
    }
  }

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const available = run.results.filter((r) => !added.has(r.track.id));
  const pickBest = (n = 10) => setPicked(new Set(available.slice(0, n).map((r) => r.track.id)));

  /** Lagrer de valgte i biblioteket («to get», merket «web find») og gir id-ene tilbake */
  async function addPicked(): Promise<string[]> {
    const chosen = run.results.filter((r) => picked.has(r.track.id));
    if (!chosen.length) return [];
    const r = await upsertImportedTracks(
      chosen.map(({ track: t }) => ({
        artist: t.artist,
        title: t.title,
        version: t.version,
        bpm: t.bpm,
        camelot: t.camelot,
        durationSec: t.durationSec,
        genre: run.mode === 'genre' ? run.label.replace(/^\w/, (c) => c.toUpperCase()) : '',
        notes: `Found on the web for “${setName}” (${t.reason}).`,
        sources: { ...(t.bpm != null ? { bpm: 'online' as const } : {}), ...(t.camelot ? { camelot: 'online' as const } : {}) },
      })),
      { status: 'wishlist', tags: ['web find'] },
    );
    setAdded((a) => new Set([...a, ...chosen.map((c) => c.track.id)]));
    setPicked(new Set());
    return r.ids;
  }

  return { mode, setMode: setModeChoice, genre, setGenre, suggested, genreChips, seeds, run, picked, added, toggle, pickBest, available, addPicked, search, stop: () => ctrl.current?.abort(), canSearch, query, preview };
}

export type WebFinder = ReturnType<typeof useWebFinder>;

export function WebFinderPanel({ w, hasSet }: { w: WebFinder; hasSet: boolean }) {
  const [settings] = useSettings();
  const { run } = w;
  const p = run.progress;
  const progressText =
    !p || p.phase === 'artists' || p.phase === 'playlists'
      ? run.mode === 'genre'
        ? `Finding ${run.label} playlists…`
        : `Finding ${run.label}…`
      : p.phase === 'tracks'
          ? `Collecting tracks… ${p.checked}/${p.total} ${run.mode === 'genre' ? 'playlists' : 'artists'}`
          : `Checking BPM and key… ${p.checked}/${p.total} tracks`;

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        className="w-full"
        value={w.mode}
        onChange={w.setMode}
        options={[
          {
            value: 'similar',
            label: (
              <>
                <Users size={15} /> Similar artists
              </>
            ),
          },
          {
            value: 'genre',
            label: (
              <>
                <Tags size={15} /> Same genre
              </>
            ),
          },
        ]}
      />

      {w.mode === 'similar' ? (
        <p className="text-[13px] text-ink2">
          {w.seeds.length ? (
            <>
              Finds artists similar to <strong className="font-medium text-ink">{listNames(w.seeds)}</strong> on Deezer and their popular tracks, checks BPM and key, and ranks them by how well they mix with your set.
            </>
          ) : (
            'Add a few tracks to the set first — or search by genre.'
          )}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <input
              className="input min-w-0 flex-1 basis-56"
              placeholder={w.suggested ? `Genre — e.g. ${w.suggested}` : 'Genre — e.g. trance, melodic techno'}
              value={w.genre}
              onChange={(e) => w.setGenre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void w.search()}
              aria-label="Genre"
            />
          </div>
          {w.genreChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {w.genreChips.map((g) => (
                <Chip key={g} active={w.query.toLowerCase() === g.toLowerCase()} onClick={() => w.setGenre(g)}>
                  {g}
                </Chip>
              ))}
            </div>
          )}
          <p className="text-[13px] text-ink2">Uses popular Deezer playlists for the genre, checks BPM and key, and {hasSet ? 'ranks the tracks by how well they mix with your set.' : 'lists what it finds.'}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {run.status === 'running' ? (
          <Button variant="ghost" onClick={w.stop}>
            Stop
          </Button>
        ) : (
          <Button variant="primary" disabled={!w.canSearch} onClick={() => void w.search()}>
            <Globe size={16} /> {run.status === 'idle' ? 'Search the web' : 'Search again'}
          </Button>
        )}
        {!settings.getSongBpmKey && (
          <span className="text-[13px] text-ok">
            Add your GetSongBPM key in{' '}
            <a href={href({ name: 'settings' })} className="underline">
              Settings
            </a>{' '}
            to match keys.
          </span>
        )}
      </div>

      {run.status === 'running' && (
        <div className="flex flex-col gap-1.5">
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
      {run.status === 'error' && <p className="text-[13px] text-[#f07a7a]">Search failed: {run.error}</p>}
      {run.status === 'done' && !run.results.length && <p className="text-sm text-muted">Nothing found that fits. Try another genre, or “Search again” later.</p>}
      {run.notes.map((n) => (
        <p key={n} className="text-[13px] text-ok">
          {n}
        </p>
      ))}

      {run.results.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 px-2 text-xs text-muted">
            <span>
              {run.results.length} for {run.label}
              {hasSet && run.results[0].fit != null && ' · best fit first'}
            </span>
            {w.available.length > 0 && (
              <button type="button" className="text-accent hover:underline" onClick={() => w.pickBest(10)}>
                Select best {Math.min(10, w.available.length)}
              </button>
            )}
          </div>
          <ul className="flex flex-col">
            {run.results.map((s) => {
              const t = s.track;
              const done = w.added.has(t.id);
              const grade = s.fit == null ? null : s.fit >= 75 ? GRADE_STYLE.good : GRADE_STYLE.ok;
              return (
                <WebTrackRow
                  key={t.id}
                  track={t}
                  preview={w.preview}
                  dim={done}
                  lead={
                    <input
                      type="checkbox"
                      className="h-[18px] w-[18px] shrink-0 accent-[#ef6a3a]"
                      aria-label={`Select ${t.artist} – ${t.title}`}
                      disabled={done}
                      checked={done || w.picked.has(t.id)}
                      onChange={() => w.toggle(t.id)}
                    />
                  }
                  side={
                    <>
                      <span className="w-10 text-right tabular-nums text-ink2">{t.bpm ? Math.round(t.bpm) : '–'}</span>
                      <KeyBadge camelot={t.camelot} showMusical={false} link={false} />
                      {done ? (
                        <span className="ml-auto w-32 text-right text-xs text-muted">In the pool · to get</span>
                      ) : grade ? (
                        <span
                          className="ml-auto flex w-32 flex-col items-end text-xs leading-tight"
                          title={s.best ? `Best with ${s.best.artist} – ${s.best.title}${s.best.camelot ? ` (${s.best.camelot})` : ''}` : undefined}
                        >
                          <span className={grade.text}>
                            {grade.icon} fit {s.fit}
                          </span>
                          <span className="text-muted">
                            mixes with {s.matches} track{s.matches === 1 ? '' : 's'}
                          </span>
                        </span>
                      ) : (
                        <span className="ml-auto w-32" />
                      )}
                    </>
                  }
                />
              );
            })}
          </ul>
          <p className="px-2 pt-2 text-xs text-muted">Fit is the average of a track’s three best transitions with tracks in this set. Added tracks go to your library as “to get” (tagged “web find”) and into the pool. They have no energy level yet.</p>
        </div>
      )}
    </div>
  );
}
