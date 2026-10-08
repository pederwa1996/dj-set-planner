import Dexie, { type EntityTable } from 'dexie';
import type { DjSet, Tombstone, Track } from './types';

export class DjDatabase extends Dexie {
  tracks!: EntityTable<Track, 'id'>;
  sets!: EntityTable<DjSet, 'id'>;
  /** Slettede låter/sets, så slettingen kan synkroniseres til andre enheter */
  tombstones!: EntityTable<Tombstone, 'key'>;

  constructor(name = 'dj-set-planner') {
    super(name);
    this.version(1).stores({
      tracks: 'id, artist, title, bpm, camelot, energy, genre, status, dupKey, *tags, updatedAt',
    });
    this.version(2).stores({
      tracks: 'id, artist, title, bpm, camelot, energy, genre, status, dupKey, *tags, updatedAt',
      sets: 'id, name, date, updatedAt',
    });
    this.version(3).stores({
      tracks: 'id, artist, title, bpm, camelot, energy, genre, status, dupKey, *tags, updatedAt',
      sets: 'id, name, date, updatedAt',
      tombstones: 'key, kind, deletedAt',
    });
  }
}

export const db = new DjDatabase();

export type SyncKind = 'track' | 'set';
export const tombstoneKey = (kind: SyncKind, id: string) => `${kind}:${id}`;

/** Registrer slettinger (kalles i samme transaksjon som selve slettingen) */
export async function addTombstones(database: DjDatabase, kind: SyncKind, ids: string[], at = new Date().toISOString()) {
  if (!ids.length) return;
  await database.tombstones.bulkPut(ids.map((id) => ({ key: tombstoneKey(kind, id), kind, id, deletedAt: at })));
}

/** Be nettleseren om ikke å slette dataene ved lite lagringsplass. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignorer */
  }
  return false;
}
