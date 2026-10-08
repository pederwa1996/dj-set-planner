import { db as defaultDb, type DjDatabase } from './db';
import type { DjSet, Track } from './types';
import { emptyTrack } from './tracks';
import { makeDupKey } from '../lib/normalize';

export const BACKUP_FORMAT = 'dj-set-planner-backup';
export const BACKUP_VERSION = 2;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  tables: { tracks: Track[]; sets?: DjSet[] };
}

export async function createBackup(database: DjDatabase = defaultDb): Promise<Backup> {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables: { tracks: await database.tracks.toArray(), sets: await database.sets.toArray() },
  };
}

/**
 * Les inn en backup. "replace" tømmer databasen først; "merge" legger til
 * og overskriver låter med samme id.
 */
export async function restoreBackup(data: unknown, mode: 'replace' | 'merge', database: DjDatabase = defaultDb): Promise<number> {
  const b = data as Partial<Backup>;
  if (!b || b.format !== BACKUP_FORMAT || !b.tables || !Array.isArray(b.tables.tracks)) {
    throw new Error('This is not a valid DJ Set Planner backup file.');
  }
  if ((b.version ?? 0) > BACKUP_VERSION) throw new Error('This backup was made by a newer version of the app.');
  // Fyll inn felter som kan mangle i eldre backuper
  const tracks: Track[] = b.tables.tracks.map((t) => {
    const full = { ...emptyTrack(), ...t } as Track;
    full.dupKey = makeDupKey(full.artist, full.title, full.version);
    return full;
  });
  const sets = Array.isArray(b.tables.sets) ? b.tables.sets : [];
  await database.transaction('rw', database.tracks, database.sets, async () => {
    if (mode === 'replace') {
      await database.tracks.clear();
      await database.sets.clear();
    }
    await database.tracks.bulkPut(tracks);
    await database.sets.bulkPut(sets);
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
