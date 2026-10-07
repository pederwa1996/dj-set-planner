import Dexie, { type EntityTable } from 'dexie';
import type { DjSet, Track } from './types';

export class DjDatabase extends Dexie {
  tracks!: EntityTable<Track, 'id'>;
  sets!: EntityTable<DjSet, 'id'>;

  constructor(name = 'dj-set-planner') {
    super(name);
    this.version(1).stores({
      tracks: 'id, artist, title, bpm, camelot, energy, genre, status, dupKey, *tags, updatedAt',
    });
    this.version(2).stores({
      tracks: 'id, artist, title, bpm, camelot, energy, genre, status, dupKey, *tags, updatedAt',
      sets: 'id, name, date, updatedAt',
    });
  }
}

export const db = new DjDatabase();

/** Be nettleseren om ikke å slette dataene ved lite lagringsplass. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignorer */
  }
  return false;
}
