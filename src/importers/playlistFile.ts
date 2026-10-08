import type { NewTrack } from '../db/types';
import { importCsv } from './csvImport';
import { parseTextList } from './textList';

export interface PlaylistFile {
  /** Spillelistens navn, utledet fra filnavnet ("saturday_warmup.csv" → "Saturday warmup") */
  name: string;
  tracks: NewTrack[];
  error?: string;
  /** Hvor mange spor som hadde BPM / key / energi i selve filen */
  withData: { bpm: number; key: number; energy: number };
}

export function playlistNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Imported playlist';
}

export function isPlaylistFile(name: string): boolean {
  return /\.(csv|tsv|txt)$/i.test(name);
}

/** Les en Exportify-/TuneMyMusic-CSV eller en tekstliste («Artist - Tittel» per linje). */
export function parsePlaylistText(fileName: string, text: string): PlaylistFile {
  const name = playlistNameFromFile(fileName);
  if (/\.txt$/i.test(fileName)) {
    const tracks = parseTextList(text).flatMap((p) => (p.track ? [p.track] : []));
    return { name, tracks, withData: { bpm: 0, key: 0, energy: 0 }, error: tracks.length ? undefined : 'No “Artist - Title” lines found in the file.' };
  }
  const r = importCsv(text);
  return { name, tracks: r.tracks, error: r.error, withData: r.hasAudioFeatures };
}

export async function readPlaylistFile(file: File): Promise<PlaylistFile> {
  if (!isPlaylistFile(file.name)) return { name: playlistNameFromFile(file.name), tracks: [], withData: { bpm: 0, key: 0, energy: 0 }, error: 'Use a .csv file from Exportify (or a .txt list).' };
  return parsePlaylistText(file.name, await file.text());
}
