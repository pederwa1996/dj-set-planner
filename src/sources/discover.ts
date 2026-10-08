import type { Track } from '../db/types';
import { findBridges } from '../engine/bridge';
import type { MixTrack } from '../engine/types';
import { primaryArtist } from '../engine/sequencer';
import { splitVersion } from '../importers/textList';
import { makeDupKey } from '../lib/normalize';
import { getSettings } from '../lib/settings';
import { deezerGet } from './deezer';
import { getSongBpmAdapter } from './getsongbpm';

/*
 * Finn brolåter på nettet: artister som ligner på de to låtene (Deezer «related»),
 * deres mest populære låter, BPM/key fra GetSongBPM (eller Deezer), og til slutt
 * samme rangering som for låter i biblioteket.
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
  phase: 'artists' | 'tracks' | 'analysing' | 'done';
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

async function findArtist(deps: DiscoverDeps, name: string): Promise<{ id: string; name: string } | null> {
  const res = await deps.deezer<{ data?: Obj[] }>(`/search/artist?limit=3&q=${encodeURIComponent(name)}`);
  const a = res.data?.find((x) => primaryArtist(String(x.name ?? '')) === primaryArtist(name)) ?? res.data?.[0];
  return a ? { id: String(a.id), name: String(a.name) } : null;
}

export async function discoverBridges(
  from: Track,
  to: Track,
  library: Track[],
  opts: { deps?: DiscoverDeps; onProgress?: (p: DiscoverProgress) => void; signal?: AbortSignal; maxArtists?: number; perArtist?: number; maxCandidates?: number; maxTempoPct?: number } = {},
): Promise<{ suggestions: WebSuggestion[]; checked: number; notes: string[] }> {
  const deps = opts.deps ?? defaultDeps();
  const notes: string[] = [];
  const stop = () => opts.signal?.aborted;
  opts.onProgress?.({ phase: 'artists', checked: 0, total: 0 });

  // 1. Artistene bak de to låtene, og artister som ligner
  const seeds = Array.from(new Set([from.artist, to.artist].map((a) => a.split(/\s*(?:,|&| feat\.?| ft\.?| x )\s*/i)[0].trim()).filter(Boolean)));
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
  // Fletter de to listene, så begge sider av overgangen er representert
  for (let i = 0; related.some((l) => i < l.length); i++) for (const l of related) if (l[i] && !artists.some((x) => x.id === l[i].id)) artists.push(l[i]);
  const pickArtists = artists.slice(0, opts.maxArtists ?? 10);

  // 2. Populære låter fra disse artistene
  opts.onProgress?.({ phase: 'tracks', checked: 0, total: pickArtists.length });
  const known = new Set(library.map((t) => t.dupKey));
  const candidates: WebTrack[] = [];
  const seen = new Set<string>();
  for (const [i, a] of pickArtists.entries()) {
    if (stop()) break;
    try {
      const top = await deps.deezer<{ data?: Obj[] }>(`/artist/${a.id}/top?limit=${opts.perArtist ?? 4}`);
      for (const t of top.data ?? []) {
        const artist = String((t.artist as Obj | undefined)?.name ?? a.name);
        const sv = splitVersion(String(t.title_short ?? t.title ?? ''));
        const version = String(t.title_version ?? '').replace(/^\s*[([]|[)\]]\s*$/g, '').trim() || sv.version;
        const dupKey = makeDupKey(artist, sv.title, version);
        if (known.has(dupKey) || seen.has(dupKey)) continue;
        seen.add(dupKey);
        const album = t.album as Obj | undefined;
        candidates.push({
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
          reason: a.reason,
        });
      }
    } catch {
      /* hopp over artisten */
    }
    opts.onProgress?.({ phase: 'tracks', checked: i + 1, total: pickArtists.length });
  }
  const pool = candidates.slice(0, opts.maxCandidates ?? 32);

  // 3. BPM og key for hver kandidat
  let checked = 0;
  for (const c of pool) {
    if (stop()) break;
    const r = await deps.analyse({ artist: c.artist, title: c.title, version: c.version, deezerId: c.id.slice(4) });
    c.bpm = r.bpm;
    c.camelot = r.camelot;
    checked++;
    opts.onProgress?.({ phase: 'analysing', checked, total: pool.length });
  }

  // 4. Samme rangering som for biblioteket
  const ranked = findBridges(from, to, pool.filter((c) => c.bpm != null || c.camelot != null), { limit: 12, maxTempoPct: opts.maxTempoPct });
  if (!pool.some((c) => c.camelot)) notes.push('No keys found — add your GetSongBPM key in Settings for key-matched suggestions.');
  opts.onProgress?.({ phase: 'done', checked, total: pool.length });
  return { suggestions: ranked.map((r) => ({ track: r.track, score: r.score, into: r.into, out: r.out })), checked, notes };
}
