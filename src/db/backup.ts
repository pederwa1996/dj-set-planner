import { db as defaultDb, type DjDatabase } from './db';
import type { Track } from './types';
import { emptyTrack } from './tracks';
import { makeDupKey } from '../lib/normalize';

export const BACKUP_FORMAT = 'dj-set-planner-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  tables: { tracks: Track[] };
}

export async function createBackup(database: DjDatabase = defaultDb): Promise<Backup> {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables: { tracks: await database.tracks.toArray() },
  };
}

/**
 * Les inn en backup. "replace" tømmer databasen først; "merge" legger til
 * og overskriver låter med samme id.
 */
export async function restoreBackup(data: unknown, mode: 'replace' | 'merge', database: DjDatabase = defaultDb): Promise<number> {
  const b = data as Partial<Backup>;
  if (!b || b.format !== BACKUP_FORMAT || !b.tables || !Array.isArray(b.tables.tracks)) {
    throw new Error('Filen er ikke en gyldig backup fra DJ Set Planner.');
  }
  if ((b.version ?? 0) > BACKUP_VERSION) throw new Error('Backupen er laget av en nyere versjon av appen.');
  // Fyll inn felter som kan mangle i eldre backuper
  const tracks: Track[] = b.tables.tracks.map((t) => {
    const full = { ...emptyTrack(), ...t } as Track;
    full.dupKey = makeDupKey(full.artist, full.title, full.version);
    return full;
  });
  await database.transaction('rw', database.tracks, async () => {
    if (mode === 'replace') await database.tracks.clear();
    await database.tracks.bulkPut(tracks);
  });
  return tracks.length;
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
