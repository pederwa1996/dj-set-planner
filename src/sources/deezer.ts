import { fetchJson, jsonp, rateLimiter } from './http';
import { matchScore } from './match';
import { emptyCandidate, type Candidate, type LookupQuery, type SourceAdapter } from './types';

/*
 * Deezer: åpen API uten nøkkel. Gir lengde, utgivelsesdato, label og iblant BPM
 * (0 betyr ukjent). Deezer har ikke CORS, så vi går via /api/deezer-proxyen
 * og faller tilbake til JSONP.
 */
const PROXY = '/api/deezer';
const DIRECT = 'https://api.deezer.com';
const limit = rateLimiter(150);

type Obj = Record<string, unknown>;

async function get<T>(path: string): Promise<T> {
  await limit();
  let data: T;
  try {
    data = await fetchJson<T>(PROXY + path);
  } catch {
    data = await jsonp<T>(`${DIRECT}${path}${path.includes('?') ? '&' : '?'}output=jsonp`);
  }
  const err = (data as Obj | null)?.error as Obj | undefined;
  if (err) throw new Error(`Deezer: ${String(err.message ?? 'feil')}`);
  return data;
}

export function parseDeezerTrack(t: Obj, q: LookupQuery): Candidate {
  const c = emptyCandidate('deezer', String(t.id ?? ''));
  const artist = t.artist as Obj | undefined;
  const album = t.album as Obj | undefined;
  c.artist = String(artist?.name ?? '');
  c.title = String(t.title_short ?? t.title ?? '');
  c.version = String(t.title_version ?? '')
    .replace(/^\s*[([]|[)\]]\s*$/g, '')
    .trim();
  c.durationSec = Number(t.duration) > 0 ? Number(t.duration) : null;
  c.bpm = Number(t.bpm) > 0 ? Math.round(Number(t.bpm) * 100) / 100 : null;
  c.album = album?.title ? String(album.title) : null;
  const date = String(t.release_date ?? album?.release_date ?? '');
  c.year = /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;
  c.url = t.link ? String(t.link) : null;
  c.confidence = matchScore(q, c);
  return c;
}

export const deezerAdapter: SourceAdapter = {
  id: 'deezer',
  async search(q) {
    const strict = `artist:"${q.artist}" track:"${q.title}"`;
    let res = await get<{ data?: Obj[] }>(`/search?limit=10&q=${encodeURIComponent(strict)}`);
    if (!res.data?.length) res = await get<{ data?: Obj[] }>(`/search?limit=10&q=${encodeURIComponent(`${q.artist} ${q.title}`)}`);
    const cands = (res.data ?? []).map((t) => parseDeezerTrack(t, q)).sort((a, b) => b.confidence - a.confidence);
    const best = cands[0];
    if (best && best.confidence >= 0.6) {
      // Detaljer: BPM og dato ligger på track, label og sjanger på album
      const full = await get<Obj>(`/track/${best.sourceId}`);
      const merged = { ...parseDeezerTrack(full, q), confidence: best.confidence };
      const albumId = (full.album as Obj | undefined)?.id;
      if (albumId) {
        try {
          const album = await get<Obj>(`/album/${albumId}`);
          merged.label = album.label ? String(album.label) : null;
          const g = ((album.genres as Obj | undefined)?.data as Obj[] | undefined)?.[0];
          merged.genre = g?.name ? String(g.name) : null;
        } catch {
          /* album er bare bonus */
        }
      }
      cands[0] = merged;
    }
    return cands.slice(0, 5);
  },
};
