import type { Track } from '../db/types';
import { findBridges } from '../engine/bridge';
import { scoreTransition, type TransitionOptions } from '../engine/transition';
import type { MixTrack } from '../engine/types';
import { primaryArtist } from '../engine/sequencer';
import { splitVersion } from '../importers/textList';
import { makeDupKey } from '../lib/normalize';
import { getSettings } from '../lib/settings';
import { deezerGet } from './deezer';
import { getSongBpmAdapter } from './getsongbpm';

/*
 * Finn låter på nettet som ikke er i biblioteket:
 * - brolåter: artister som ligner på de to låtene (Deezer «related») og deres mest populære låter
 * - til et set: artister som ligner på artistene i settet, eller populære spillelister for en sjanger
 * Deretter BPM/key fra GetSongBPM (eller BPM fra Deezer), og rangering etter hvor godt de mikser.
 */

export interface WebTrack extends MixTrack {
  version: string;
  album: string | null;
  year: number | null;
  /** 30 sekunders forhåndslytt fra Deezer */
  preview: string | null;
  url: string | null;
  /** Hvorfor den er med, f.eks. «similar to Chicane» */
  reason: string;
}

export interface WebSuggestion {
  track: WebTrack;
  score: number;
  into: number;
  out: number;
}

export interface DiscoverProgress {
  phase: 'artists' | 'playlists' | 'tracks' | 'analysing' | 'done';
  checked: number;
  total: number;
}

type Obj = Record<string, unknown>;

export interface DiscoverDeps {
  deezer: <T>(path: string) => Promise<T>;
  /** BPM og key for en låt (null hvis ukjent) */
  analyse: (t: { artist: string; title: string; version: string; deezerId: string }) => Promise<{ bpm: number | null; camelot: string | null }>;
}

/** Standard: GetSongBPM for BPM/key når nøkkel finnes, ellers BPM fra Deezer */
export function defaultDeps(): DiscoverDeps {
  const key = getSettings().getSongBpmKey;
  const gs = key ? getSongBpmAdapter(key) : null;
  return {
    deezer: deezerGet,
    async analyse(t) {
      if (gs) {
        try {
          const hits = await gs.search({ artist: t.artist, title: t.title, version: t.version });
          const best = hits.find((h) => h.confidence >= 0.75);
          if (best && (best.bpm || best.camelot)) return { bpm: best.bpm, camelot: best.camelot };
        } catch {
          /* prøv Deezer under */
        }
      }
      try {
        const full = await deezerGet<Obj>(`/track/${t.deezerId}`);
        const bpm = Number(full.bpm);
        return { bpm: bpm > 0 ? Math.round(bpm * 10) / 10 : null, camelot: null };
      } catch {
        return { bpm: null, camelot: null };
      }
    },
  };
}

interface StepOpts {
  onProgress?: (p: DiscoverProgress) => void;
  signal?: AbortSignal;
}

async function findArtist(deps: DiscoverDeps, name: string): Promise<{ id: string; name: string } | null> {
  const res = await deps.deezer<{ data?: Obj[] }>(`/search/artist?limit=3&q=${encodeURIComponent(name)}`);
  const a = res.data?.find((x) => primaryArtist(String(x.name ?? '')) === primaryArtist(name)) ?? res.data?.[0];
  return a ? { id: String(a.id), name: String(a.name) } : null;
}

/** Låter som ikke skal foreslås: de du har, i alle versjoner */
const skipSet = (library: Pick<Track, 'artist' | 'title' | 'dupKey'>[]) => new Set(library.flatMap((t) => [t.dupKey, makeDupKey(t.artist, t.title, '')]));

/** Første artist i «A feat. B», «A & B» osv. */
const leadArtist = (artist: string) => artist.split(/\s*(?:,|&| feat\.?| ft\.?| x )\s*/i)[0].trim();

/** Deezer-låt → WebTrack (null hvis vi har den fra før) */
function toWebTrack(t: Obj, fallbackArtist: string, reason: string, skip: Set<string>): WebTrack | null {
  const artist = String((t.artist as Obj | undefined)?.name ?? fallbackArtist);
  const sv = splitVersion(String(t.title_short ?? t.title ?? ''));
  const version = String(t.title_version ?? '').replace(/^\s*[([]|[)\]]\s*$/g, '').trim() || sv.version;
  if (!artist || !sv.title) return null;
  // Hopp over låter vi har – også i en annen versjon (samme artist og tittel)
  const dupKey = makeDupKey(artist, sv.title, version);
  const songKey = makeDupKey(artist, sv.title, '');
  if (skip.has(dupKey) || skip.has(songKey)) return null;
  skip.add(dupKey);
  skip.add(songKey);
  const album = t.album as Obj | undefined;
  return {
    id: `web:${t.id}`,
    artist,
    title: sv.title,
    version,
    bpm: null,
    camelot: null,
    energy: null,
    durationSec: Number(t.duration) > 0 ? Number(t.duration) : null,
    album: album?.title ? String(album.title) : null,
    year: null,
    preview: t.preview ? String(t.preview) : null,
    url: t.link ? String(t.link) : null,
    reason,
  };
}

/**
 * Populære låter fra artistene selv og artister som ligner (Deezer «related»).
 * Listene for hver artist flettes, så alle artistene er representert.
 */
export async function relatedCandidates(seedNames: string[], skip: Set<string>, deps: DiscoverDeps, opts: StepOpts & { maxArtists?: number; perArtist?: number } = {}): Promise<{ candidates: WebTrack[]; notes: string[] }> {
  const notes: string[] = [];
  const stop = () => opts.signal?.aborted;
  opts.onProgress?.({ phase: 'artists', checked: 0, total: 0 });
  const seeds = Array.from(new Set(seedNames.map(leadArtist).filter(Boolean)));
  const artists: { id: string; name: string; reason: string }[] = [];
  const related: { id: string; name: string; reason: string }[][] = [];
  for (const name of seeds) {
    if (stop()) break;
    try {
      const a = await findArtist(deps, name);
      if (!a) continue;
      artists.push({ ...a, reason: `more from ${a.name}` });
      const rel = await deps.deezer<{ data?: Obj[] }>(`/artist/${a.id}/related?limit=10`);
      related.push((rel.data ?? []).map((r) => ({ id: String(r.id), name: String(r.name), reason: `similar to ${a.name}` })));
    } catch {
      notes.push(`Couldn’t look up ${name} on Deezer.`);
    }
  }
  for (let i = 0; related.some((l) => i < l.length); i++) for (const l of related) if (l[i] && !artists.some((x) => x.id === l[i].id)) artists.push(l[i]);
  const pickArtists = artists.slice(0, opts.maxArtists ?? 10);

  opts.onProgress?.({ phase: 'tracks', checked: 0, total: pickArtists.length });
  const candidates: WebTrack[] = [];
  for (const [i, a] of pickArtists.entries()) {
    if (stop()) break;
    try {
      const top = await deps.deezer<{ data?: Obj[] }>(`/artist/${a.id}/top?limit=${opts.perArtist ?? 4}`);
      for (const t of top.data ?? []) {
        const w = toWebTrack(t, a.name, a.reason, skip);
        if (w) candidates.push(w);
      }
    } catch {
      /* hopp over artisten */
    }
    opts.onProgress?.({ phase: 'tracks', checked: i + 1, total: pickArtists.length });
  }
  return { candidates, notes };
}

/** Låter fra de mest relevante Deezer-spillelistene for en sjanger («trance», «melodic techno» …) */
export async function genreCandidates(query: string, skip: Set<string>, deps: DiscoverDeps, opts: StepOpts & { playlists?: number; perPlaylist?: number } = {}): Promise<{ candidates: WebTrack[]; notes: string[]; playlists: string[] }> {
  const notes: string[] = [];
  const stop = () => opts.signal?.aborted;
  opts.onProgress?.({ phase: 'playlists', checked: 0, total: 0 });
  const q = query.trim();
  let lists: Obj[] = [];
  try {
    const res = await deps.deezer<{ data?: Obj[] }>(`/search/playlist?limit=10&q=${encodeURIComponent(q)}`);
    lists = res.data ?? [];
  } catch {
    notes.push('Couldn’t search playlists on Deezer.');
  }
  // Spillelister med sjangeren i navnet og nok låter først
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const relevance = (l: Obj) => {
    const title = String(l.title ?? '').toLowerCase();
    return (words.every((w) => title.includes(w)) ? 2 : 0) + (Number(l.nb_tracks ?? 0) >= 15 ? 1 : 0);
  };
  const picked = lists
    .map((l, i) => ({ l, i, r: relevance(l) }))
    .sort((a, b) => b.r - a.r || a.i - b.i)
    .slice(0, opts.playlists ?? 3)
    .map((x) => x.l);
  if (!picked.length && !notes.length) notes.push(`No playlists found for “${q}” on Deezer.`);

  opts.onProgress?.({ phase: 'tracks', checked: 0, total: picked.length });
  const perList: WebTrack[][] = [];
  for (const [i, l] of picked.entries()) {
    if (stop()) break;
    const title = String(l.title ?? 'a playlist');
    try {
      const res = await deps.deezer<{ data?: Obj[] }>(`/playlist/${l.id}/tracks?limit=${opts.perPlaylist ?? 40}`);
      perList.push((res.data ?? []).map((t) => toWebTrack(t, '', `in “${title}”`, skip)).filter((w): w is WebTrack => !!w));
    } catch {
      /* hopp over spillelisten */
    }
    opts.onProgress?.({ phase: 'tracks', checked: i + 1, total: picked.length });
  }
  // Flett listene for variasjon
  const candidates: WebTrack[] = [];
  for (let i = 0; perList.some((l) => i < l.length); i++) for (const l of perList) if (l[i]) candidates.push(l[i]);
  return { candidates, notes, playlists: picked.map((l) => String(l.title ?? '')) };
}

/** BPM og key for hver kandidat (endrer kandidatene). Returnerer hvor mange som ble sjekket. */
export async function analyseCandidates(cands: WebTrack[], deps: DiscoverDeps, opts: StepOpts = {}): Promise<number> {
  let checked = 0;
  for (const c of cands) {
    if (opts.signal?.aborted) break;
    const r = await deps.analyse({ artist: c.artist, title: c.title, version: c.version, deezerId: c.id.slice(4) });
    c.bpm = r.bpm;
    c.camelot = r.camelot;
    checked++;
    opts.onProgress?.({ phase: 'analysing', checked, total: cands.length });
  }
  return checked;
}

const NO_KEYS = 'No keys found — add your GetSongBPM key in Settings for key-matched suggestions.';

export async function discoverBridges(
  from: Track,
  to: Track,
  library: Track[],
  opts: { deps?: DiscoverDeps; onProgress?: (p: DiscoverProgress) => void; signal?: AbortSignal; maxArtists?: number; perArtist?: number; maxCandidates?: number; maxTempoPct?: number } = {},
): Promise<{ suggestions: WebSuggestion[]; checked: number; notes: string[] }> {
  const deps = opts.deps ?? defaultDeps();
  const skip = skipSet(library);
  const { candidates, notes } = await relatedCandidates([from.artist, to.artist], skip, deps, opts);
  const pool = candidates.slice(0, opts.maxCandidates ?? 32);
  const checked = await analyseCandidates(pool, deps, opts);
  const ranked = findBridges(from, to, pool.filter((c) => c.bpm != null || c.camelot != null), { limit: 12, maxTempoPct: opts.maxTempoPct });
  if (!pool.some((c) => c.camelot)) notes.push(NO_KEYS);
  opts.onProgress?.({ phase: 'done', checked, total: pool.length });
  return { suggestions: ranked.map((r) => ({ track: r.track, score: r.score, into: r.into, out: r.out })), checked, notes };
}

/* ---------- Forslag til et set ---------- */

export interface SetFit {
  track: WebTrack;
  /** 0–100: snittet av de tre beste overgangene med låter i settet (null = settet har ingen BPM/key å sammenligne med) */
  fit: number | null;
  /** Hvor mange låter i settet den mikser godt med (score ≥ 75) */
  matches: number;
  /** Låten i settet den passer best med */
  best: { artist: string; title: string; camelot: string | null } | null;
}

const MIN_FIT = 55;

/** Ranger låter etter hvor godt de mikser med låtene i settet (begge veier). */
export function rankForSet(cands: WebTrack[], setTracks: (MixTrack & { title?: string })[], opts: TransitionOptions = {}): SetFit[] {
  const known = cands.filter((c) => c.bpm != null || c.camelot != null);
  const ref = setTracks.filter((t) => t.bpm != null || t.camelot != null);
  if (!ref.length) return [...known, ...cands.filter((c) => !known.includes(c))].map((track) => ({ track, fit: null, matches: 0, best: null }));
  return known
    .map((c) => {
      const scored = ref.map((t) => ({ t, s: Math.max(scoreTransition(t, c, opts).score, scoreTransition(c, t, opts).score) })).sort((a, b) => b.s - a.s);
      const top = scored.slice(0, 3);
      const b = scored[0].t;
      return {
        track: c,
        fit: Math.round(top.reduce((a, x) => a + x.s, 0) / top.length),
        matches: scored.filter((x) => x.s >= 75).length,
        best: { artist: b.artist, title: b.title ?? '', camelot: b.camelot },
      };
    })
    .filter((f) => f.fit >= MIN_FIT)
    .sort((a, b) => b.fit - a.fit || b.matches - a.matches);
}

/** De artistene som går igjen mest i settet (for «lignende artister») */
export function setSeedArtists(setTracks: Pick<Track, 'artist'>[], max = 3): string[] {
  const count = new Map<string, { name: string; n: number; first: number }>();
  setTracks.forEach((t, i) => {
    const name = leadArtist(t.artist);
    const key = primaryArtist(name);
    if (!key) return;
    const c = count.get(key);
    if (c) c.n++;
    else count.set(key, { name, n: 1, first: i });
  });
  return [...count.values()].sort((a, b) => b.n - a.n || a.first - b.first).slice(0, max).map((c) => c.name);
}

/** Vanligste sjanger i settet (eller i biblioteket) */
export function suggestGenre(...groups: Pick<Track, 'genre'>[][]): string {
  for (const g of groups) {
    const count = new Map<string, number>();
    for (const t of g) if (t.genre?.trim()) count.set(t.genre.trim(), (count.get(t.genre.trim()) ?? 0) + 1);
    const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) return best[0];
  }
  return '';
}

export type SetDiscoverMode = 'similar' | 'genre';

export async function discoverForSet(
  setTracks: Track[],
  library: Track[],
  opts: { mode: SetDiscoverMode; genre?: string; deps?: DiscoverDeps; onProgress?: (p: DiscoverProgress) => void; signal?: AbortSignal; maxCandidates?: number; maxTempoPct?: number },
): Promise<{ suggestions: SetFit[]; checked: number; notes: string[] }> {
  const deps = opts.deps ?? defaultDeps();
  const skip = skipSet(library);
  const max = opts.maxCandidates ?? 36;
  const found =
    opts.mode === 'genre'
      ? await genreCandidates(opts.genre ?? '', skip, deps, { ...opts, perPlaylist: 40 })
      : await relatedCandidates(setSeedArtists(setTracks), skip, deps, { ...opts, maxArtists: 12, perArtist: 3 });
  const notes = [...found.notes];
  const pool = found.candidates.slice(0, max);
  const checked = await analyseCandidates(pool, deps, opts);
  const suggestions = rankForSet(pool, setTracks, { maxTempoPct: opts.maxTempoPct });
  if (pool.length && !pool.some((c) => c.camelot)) notes.push(NO_KEYS);
  const unknown = pool.filter((c) => c.bpm == null && c.camelot == null).length;
  if (unknown && setTracks.length) notes.push(`${unknown} track${unknown === 1 ? '' : 's'} had no BPM or key online and ${unknown === 1 ? 'was' : 'were'} left out.`);
  opts.onProgress?.({ phase: 'done', checked, total: pool.length });
  return { suggestions, checked, notes };
}
