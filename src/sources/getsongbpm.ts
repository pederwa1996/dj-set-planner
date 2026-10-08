import { toCamelot } from '../engine/camelot';
import { splitVersion } from '../importers/textList';
import { fetchViaProxy, rateLimiter } from './http';
import { matchScore } from './match';
import { emptyCandidate, type Candidate, type LookupQuery, type SourceAdapter } from './types';

/*
 * GetSongBPM (getsongbpm.com/api): gratis, krever API-nøkkel og en synlig lenke
 * tilbake til getsongbpm.com. Maks 3000 kall i timen.
 * Kallene går via /api/getsongbpm (proxy i Render/Vite) for å unngå CORS-problemer.
 */
const PROXY = '/api/getsongbpm';
const DIRECT = 'https://api.getsong.co';
const limit = rateLimiter(400);

export class MissingKeyError extends Error {}

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const num = (v: unknown) => {
  const n = Number(v);
  return isFinite(n) && n > 0 ? n : null;
};

export function parseGetSongBpmItem(item: Obj, q: LookupQuery): Candidate {
  const artist = item.artist as Obj | undefined;
  const album = item.album as Obj | undefined;
  const sv = splitVersion(str(item.title ?? item.song_title));
  const c = emptyCandidate('getsongbpm', str(item.id ?? item.song_id));
  c.artist = str(artist?.name ?? item.artist_name);
  c.title = sv.title;
  c.version = sv.version;
  c.bpm = num(item.tempo);
  c.camelot = toCamelot(str(item.open_key)) ?? toCamelot(str(item.key_of));
  c.album = str(album?.title) || null;
  c.year = num(album?.year);
  const genres = artist?.genres;
  c.genre = Array.isArray(genres) && genres.length ? str(genres[0]) : null;
  c.url = str(item.uri ?? item.song_uri) || null;
  c.confidence = matchScore(q, c);
  return c;
}

export function parseGetSongBpmSearch(json: unknown, q: LookupQuery): Candidate[] {
  const search = (json as Obj | null)?.search;
  if (!Array.isArray(search)) return []; // { search: { error: "no result" } }
  return search.map((x) => parseGetSongBpmItem(x as Obj, q)).sort((a, b) => b.confidence - a.confidence);
}

export function getSongBpmAdapter(apiKey: string): SourceAdapter {
  return {
    id: 'getsongbpm',
    async search(q, signal) {
      if (!apiKey) throw new MissingKeyError('Missing GetSongBPM API key (add it in Settings).');
      const params = `/search/?api_key=${encodeURIComponent(apiKey)}&type=both&limit=10&lookup=${encodeURIComponent(`song:${q.title} artist:${q.artist}`)}`;
      await limit();
      let results = parseGetSongBpmSearch(await fetchViaProxy(PROXY + params, DIRECT + params, signal), q);
      if (!results.length) {
        // Prøv bare tittel og filtrer på artist (fanger opp ulik skrivemåte av artistnavn)
        const p2 = `/search/?api_key=${encodeURIComponent(apiKey)}&type=song&limit=20&lookup=${encodeURIComponent(q.title)}`;
        await limit();
        results = parseGetSongBpmSearch(await fetchViaProxy(PROXY + p2, DIRECT + p2, signal), q).filter((c) => c.confidence >= 0.5);
      }
      // Søketreff mangler av og til tempo/key — hent detaljer for beste treff
      const best = results[0];
      if (best && (best.bpm == null || best.camelot == null) && best.sourceId) {
        const p3 = `/song/?api_key=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(best.sourceId)}`;
        await limit();
        const song = ((await fetchViaProxy<Obj>(PROXY + p3, DIRECT + p3, signal)) as Obj).song as Obj | undefined;
        if (song) results[0] = { ...parseGetSongBpmItem(song, q), confidence: best.confidence };
      }
      return results.slice(0, 5);
    },
  };
}
