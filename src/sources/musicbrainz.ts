import { splitVersion } from '../importers/textList';
import { fetchJson, rateLimiter } from './http';
import { matchScore } from './match';
import { emptyCandidate, type Candidate, type LookupQuery, type SourceAdapter } from './types';

/*
 * MusicBrainz: åpen database uten nøkkel, støtter CORS. Gir lengde, første
 * utgivelsesår og versjonsinfo (ikke BPM/key). Maks ett kall i sekundet.
 */
const limit = rateLimiter(1100);
type Obj = Record<string, unknown>;

// Inne i en frase trenger bare " og \ escaping
const esc = (s: string) => s.replace(/["\\]/g, '\\$&');

export function parseMusicBrainz(json: unknown, q: LookupQuery): Candidate[] {
  const recs = ((json as Obj | null)?.recordings as Obj[] | undefined) ?? [];
  return recs
    .map((r) => {
      const c = emptyCandidate('musicbrainz', String(r.id ?? ''));
      const credits = (r['artist-credit'] as Obj[] | undefined) ?? [];
      c.artist = credits.map((x) => `${x.name ?? ''}${x.joinphrase ?? ''}`).join('').trim();
      const sv = splitVersion(String(r.title ?? ''));
      c.title = sv.title;
      c.version = sv.version || (/(mix|remix|edit|version)/i.test(String(r.disambiguation ?? '')) ? String(r.disambiguation) : '');
      c.durationSec = Number(r.length) > 0 ? Math.round(Number(r.length) / 1000) : null;
      const date = String(r['first-release-date'] ?? '');
      c.year = /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;
      const rel = (r.releases as Obj[] | undefined)?.[0];
      c.album = rel?.title ? String(rel.title) : null;
      c.url = r.id ? `https://musicbrainz.org/recording/${r.id}` : null;
      c.confidence = matchScore(q, c);
      return c;
    })
    .sort((a, b) => b.confidence - a.confidence);
}

export const musicBrainzAdapter: SourceAdapter = {
  id: 'musicbrainz',
  async search(q, signal) {
    const query = `recording:"${esc(q.title)}" AND artist:"${esc(q.artist)}"`;
    await limit();
    const json = await fetchJson(`https://musicbrainz.org/ws/2/recording/?fmt=json&limit=8&query=${encodeURIComponent(query)}`, { signal });
    return parseMusicBrainz(json, q).slice(0, 5);
  },
};
