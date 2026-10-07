import { db as defaultDb, type DjDatabase } from './db';
import type { DjSet, Track } from './types';
import { presetCurve } from '../engine/energy';
import { DEFAULT_PLAY_SEC } from '../engine/sequencer';
import { newId } from '../lib/normalize';

export function emptySet(name: string): DjSet {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name,
    date: null,
    venue: '',
    notes: '',
    targetMinutes: 60,
    curve: presetCurve('warmup-peak-close'),
    playMode: 'full',
    fixedMinutes: 3.5,
    artistGap: 3,
    maxTempoPct: 6,
    poolIds: [],
    slots: [],
    transitionNotes: {},
    playedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Typisk tid til å mikse inn/ut, trekkes fra lengden i «hele låten»-modus */
export const MIX_OVERLAP_SEC = 45;

export function playSecFor(set: Pick<DjSet, 'playMode' | 'fixedMinutes'>) {
  return (t: { durationSec: number | null }) =>
    set.playMode === 'fixed' ? Math.max(30, set.fixedMinutes * 60) : Math.max(60, (t.durationSec ?? DEFAULT_PLAY_SEC) - MIX_OVERLAP_SEC);
}

export const pairKey = (fromId: string, toId: string) => `${fromId}>${toId}`;

export async function createSet(name: string, database: DjDatabase = defaultDb): Promise<DjSet> {
  const s = emptySet(name);
  await database.sets.add(s);
  return s;
}

export async function saveSet(set: DjSet, database: DjDatabase = defaultDb): Promise<void> {
  await database.sets.put({ ...set, updatedAt: new Date().toISOString() });
}

export async function duplicateSet(id: string, database: DjDatabase = defaultDb): Promise<DjSet | null> {
  const s = await database.sets.get(id);
  if (!s) return null;
  const now = new Date().toISOString();
  const copy: DjSet = { ...structuredClone(s), id: newId(), name: `${s.name} (kopi)`, playedAt: null, createdAt: now, updatedAt: now };
  await database.sets.add(copy);
  return copy;
}

export async function deleteSet(id: string, database: DjDatabase = defaultDb): Promise<void> {
  await database.sets.delete(id);
}

/** Marker settet som spilt: øker «antall ganger spilt» og setter «spilt sist» på låtene. */
export async function markSetPlayed(id: string, when = new Date(), database: DjDatabase = defaultDb): Promise<void> {
  await database.transaction('rw', database.sets, database.tracks, async () => {
    const s = await database.sets.get(id);
    if (!s) return;
    const iso = when.toISOString();
    const tracks = (await database.tracks.bulkGet(s.slots.map((x) => x.trackId))).filter((t): t is Track => !!t);
    await database.tracks.bulkPut(tracks.map((t) => ({ ...t, playCount: t.playCount + 1, lastPlayedAt: iso, updatedAt: iso })));
    await database.sets.put({ ...s, playedAt: iso, updatedAt: iso });
  });
}
