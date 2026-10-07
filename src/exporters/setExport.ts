import type { DjSet, Track } from '../db/types';
import { camelotToMusical } from '../engine/camelot';
import type { SetAnalysis } from '../engine/analysis';
import { toCsv } from '../lib/csv';
import { formatDuration } from '../lib/normalize';
import { pairKey } from '../db/sets';

const fullTitle = (t: Track) => `${t.title}${t.version ? ` (${t.version})` : ''}`;

/** «Artist - Tittel (Versjon)» per linje — lim inn i TuneMyMusic/Soundiiz eller søk manuelt i Spotify */
export function setToText(tracks: Track[], opts: { numbered?: boolean } = {}): string {
  return tracks.map((t, i) => `${opts.numbered ? `${i + 1}. ` : ''}${t.artist} - ${fullTitle(t)}`).join('\n');
}

export function setToCsv(set: DjSet, tracks: Track[], analysis: SetAnalysis<Track>): string {
  const rows: (string | number | null)[][] = [['#', 'Start', 'Artist', 'Tittel', 'Versjon', 'BPM', 'Camelot', 'Key', 'Energi', 'Lengde', 'Status', 'Overgang videre', 'Score', 'Notat']];
  tracks.forEach((t, i) => {
    const tr = analysis.transitions[i];
    const next = tracks[i + 1];
    rows.push([
      i + 1,
      formatDuration(analysis.items[i]?.startSec ?? 0),
      t.artist,
      t.title,
      t.version,
      t.bpm,
      t.camelot,
      camelotToMusical(t.camelot),
      t.energy,
      formatDuration(t.durationSec),
      t.status === 'owned' ? 'har fil' : 'må skaffes',
      tr ? tr.explanation : '',
      tr ? tr.score : '',
      next ? (set.transitionNotes[pairKey(t.id, next.id)] ?? '') : '',
    ]);
  });
  return toCsv(rows);
}

export interface ShopLink {
  name: string;
  url: string;
}

/** Søkelenker for å finne/kjøpe låten */
export function shopLinks(t: Pick<Track, 'artist' | 'title' | 'version'>): ShopLink[] {
  const q = `${t.artist} ${t.title}${t.version ? ` ${t.version}` : ''}`;
  const e = encodeURIComponent(q);
  return [
    { name: 'Beatport', url: `https://www.beatport.com/search?q=${e}` },
    { name: 'Bandcamp', url: `https://bandcamp.com/search?q=${e}&item_type=t` },
    { name: 'Traxsource', url: `https://www.traxsource.com/search?term=${e}` },
    { name: 'YouTube', url: `https://www.youtube.com/results?search_query=${e}` },
    { name: 'Spotify', url: `https://open.spotify.com/search/${encodeURIComponent(`${t.artist} ${t.title}`)}` },
  ];
}

export function downloadText(text: string, filename: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(s: string): string {
  return s.replace(/[^\p{L}\p{N}\-_. ]+/gu, '').trim().replace(/\s+/g, '-') || 'set';
}
