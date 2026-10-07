import type { NewTrack } from '../db/types';
import { parseCsv } from '../lib/csv';
import { toCamelot } from '../engine/camelot';
import { splitVersion } from './textList';

type Field = 'artist' | 'title' | 'version' | 'album' | 'bpm' | 'key' | 'mode' | 'energy' | 'durationMs' | 'duration' | 'genre' | 'label' | 'year' | 'rating' | 'comment';

// Kolonnenavn fra Exportify, TuneMyMusic, Rekordbox/Serato-eksport og vanlige regneark
const ALIASES: Record<Field, string[]> = {
  artist: ['artist name(s)', 'artist name', 'artist', 'artists', 'artist(s)', 'artister', 'artist names'],
  title: ['track name', 'title', 'track title', 'track', 'song', 'song name', 'name', 'tittel', 'låt', 'sang'],
  version: ['mix', 'version', 'remix', 'mix name', 'versjon'],
  album: ['album name', 'album', 'album title'],
  bpm: ['tempo', 'bpm'],
  key: ['key', 'tonality', 'musical key', 'initial key', 'toneart'],
  mode: ['mode'],
  energy: ['energy', 'energi'],
  durationMs: ['duration (ms)', 'duration_ms', 'track duration (ms)'],
  duration: ['duration', 'time', 'length', 'lengde', 'tid'],
  genre: ['genres', 'genre', 'sjanger', 'artist genres'],
  label: ['record label', 'label'],
  year: ['release date', 'year', 'år', 'album release date'],
  rating: ['rating'],
  comment: ['comment', 'comments', 'notes', 'notater'],
};

export function detectColumns(header: string[]): Partial<Record<Field, number>> {
  const h = header.map((x) => x.trim().toLowerCase());
  const out: Partial<Record<Field, number>> = {};
  for (const [field, names] of Object.entries(ALIASES) as [Field, string[]][]) {
    for (const n of names) {
      const idx = h.indexOf(n);
      if (idx >= 0 && !Object.values(out).includes(idx)) {
        out[field] = idx;
        break;
      }
    }
  }
  return out;
}

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Spotify/Exportify: key = 0–11 (C = 0), mode = 1 dur / 0 moll */
export function spotifyKeyToCamelot(key: string, mode: string | undefined): string | null {
  const k = Number(key);
  if (!Number.isInteger(k) || k < 0 || k > 11) return null;
  const minor = mode !== undefined && Number(mode) === 0;
  return toCamelot(`${PITCH_NAMES[k]}${minor ? 'm' : ''}`);
}

function parseDurationText(s: string): number | null {
  const t = s.trim();
  const m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.\d+)?$/);
  if (m) return (Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3])) | 0;
  const n = Number(t.replace(',', '.'));
  return isFinite(n) && n > 0 ? Math.round(n) : null;
}

export interface CsvImportResult {
  tracks: NewTrack[];
  skipped: number;
  columns: Partial<Record<Field, number>>;
  /** Fikk vi med audio features (tempo/key/energi) fra f.eks. Exportify? */
  hasAudioFeatures: { bpm: number; key: number; energy: number };
  error?: string;
}

export function importCsv(text: string): CsvImportResult {
  const rows = parseCsv(text);
  const empty = { tracks: [], skipped: 0, columns: {}, hasAudioFeatures: { bpm: 0, key: 0, energy: 0 } };
  if (rows.length < 2) return { ...empty, error: 'Fant ingen rader i filen.' };
  const cols = detectColumns(rows[0]);
  if (cols.artist === undefined || cols.title === undefined) {
    return { ...empty, columns: cols, error: `Fant ikke kolonner for artist og tittel. Kolonnene i filen er: ${rows[0].join(', ')}` };
  }
  const get = (r: string[], f: Field) => (cols[f] !== undefined ? (r[cols[f]!] ?? '').trim() : '');
  const tracks: NewTrack[] = [];
  let skipped = 0;
  const stats = { bpm: 0, key: 0, energy: 0 };

  for (const r of rows.slice(1)) {
    const artist = get(r, 'artist').replace(/\s*;\s*/g, ', ').replace(/\\,/g, ',');
    const rawTitle = get(r, 'title');
    if (!artist || !rawTitle) {
      skipped++;
      continue;
    }
    const sv = splitVersion(rawTitle.replace(/\s+-\s+((?:.*\s)?(?:mix|remix|edit|version|remaster(?:ed)?(?:\s\d{4})?))$/i, ' ($1)'));
    const t: NewTrack = { artist, title: sv.title, version: get(r, 'version') || sv.version };

    const bpm = Number(get(r, 'bpm').replace(',', '.'));
    if (bpm > 0) {
      t.bpm = Math.round(bpm * 100) / 100;
      stats.bpm++;
    }
    const keyRaw = get(r, 'key');
    if (keyRaw) {
      const c = /^\d{1,2}$/.test(keyRaw) && cols.mode !== undefined ? spotifyKeyToCamelot(keyRaw, get(r, 'mode')) : toCamelot(keyRaw);
      if (c) {
        t.camelot = c;
        stats.key++;
      }
    }
    const energyRaw = get(r, 'energy');
    if (energyRaw) {
      const e = Number(energyRaw.replace(',', '.'));
      // Spotify-energi er 0–1; ellers antar vi 1–10
      if (isFinite(e) && e > 0) {
        t.energy = e <= 1 ? Math.max(1, Math.min(10, Math.round(e * 10))) : Math.max(1, Math.min(10, Math.round(e)));
        stats.energy++;
      }
    }
    const ms = Number(get(r, 'durationMs'));
    if (ms > 0) t.durationSec = Math.round(ms / 1000);
    else if (get(r, 'duration')) t.durationSec = parseDurationText(get(r, 'duration'));

    const genres = get(r, 'genre')
      .split(/\s*[,;]\s*/)
      .filter(Boolean);
    if (genres.length) t.genre = genres[0];
    const label = get(r, 'label');
    if (label) t.label = label;
    const year = get(r, 'year').match(/\d{4}/);
    if (year) t.year = Number(year[0]);
    const comment = get(r, 'comment');
    if (comment) t.notes = comment;
    t.sources = { ...(t.bpm ? { bpm: 'import' as const } : {}), ...(t.camelot ? { camelot: 'import' as const } : {}) };
    tracks.push(t);
  }
  return { tracks, skipped, columns: cols, hasAudioFeatures: stats };
}
