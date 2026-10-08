import type { NewTrack } from '../db/types';

export interface ParsedLine {
  line: number;
  raw: string;
  track: NewTrack | null;
  problem?: string;
}

const VERSION_RE = /^(.*?)\s*[([]([^)\]]*\b(mix|remix|edit|dub|version|rework|bootleg|vip|remaster(?:ed)?|extended|radio)\b[^)\]]*)[)\]]\s*$/i;

/** Del "Tittel (Club Mix)" i tittel og versjon. */
export function splitVersion(title: string): { title: string; version: string } {
  const m = title.match(VERSION_RE);
  return m ? { title: m[1].trim(), version: m[2].trim() } : { title: title.trim(), version: '' };
}

/**
 * Tolker en innlimt liste, én låt per linje. Godtar bl.a.:
 *   Artist - Tittel            Artist – Tittel (Remix)
 *   1. Artist - Tittel         01 Artist — Tittel
 *   Tittel by Artist           Tittel<TAB>Artist (kopiert fra regneark: første kolonne = tittel hvis header sier det)
 */
export function parseTextList(text: string, opts: { order?: 'artist-title' | 'title-artist' } = {}): ParsedLine[] {
  const order = opts.order ?? 'artist-title';
  return text.split(/\r?\n/).flatMap((raw, i): ParsedLine[] => {
    let s = raw.trim();
    if (!s || s.startsWith('#')) return [];
    if (/^https?:\/\//i.test(s)) {
      return [{ line: i + 1, raw, track: null, problem: "Link — can't be read without a name. Use an Exportify CSV for Spotify playlists." }];
    }
    s = s
      .replace(/^\d{1,3}\s*[.)\]:-]?\s+/, '') // nummerering
      .replace(/\s+\d{1,2}:\d{2}$/, ''); // lengde på slutten
    let artist = '';
    let title = '';
    if (s.includes('\t')) {
      const [a, b] = s.split('\t').map((x) => x.trim());
      [artist, title] = order === 'artist-title' ? [a, b] : [b, a];
    } else {
      const m = s.match(/^(.+?)\s+[-–—]\s+(.+)$/) ?? s.match(/^(.+?)\s*[–—]\s*(.+)$/);
      if (m) [artist, title] = order === 'artist-title' ? [m[1], m[2]] : [m[2], m[1]];
      else {
        const by = s.match(/^(.+?)\s+by\s+(.+)$/i);
        if (by) [title, artist] = [by[1], by[2]];
      }
    }
    artist = artist.trim();
    title = title.trim().replace(/^["“]|["”]$/g, '');
    if (!artist || !title) return [{ line: i + 1, raw, track: null, problem: 'Couldn\'t find "Artist - Title"' }];
    const v = splitVersion(title);
    return [{ line: i + 1, raw, track: { artist, title: v.title, version: v.version } }];
  });
}
