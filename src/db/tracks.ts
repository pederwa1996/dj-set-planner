import { db as defaultDb, type DjDatabase } from './db';
import type { NewTrack, Track } from './types';
import { makeDupKey, newId } from '../lib/normalize';
import { toCamelot } from '../engine/camelot';

export function emptyTrack(): Omit<Track, 'id' | 'dupKey' | 'createdAt' | 'updatedAt'> {
  return {
    artist: '',
    title: '',
    version: '',
    label: '',
    year: null,
    durationSec: null,
    bpm: null,
    camelot: null,
    energy: null,
    genre: '',
    subgenre: '',
    tags: [],
    mood: '',
    rating: 0,
    notes: '',
    introBars: null,
    outroBars: null,
    status: 'owned',
    playCount: 0,
    lastPlayedAt: null,
    analysis: null,
    sources: {},
    file: null,
  };
}

const clamp = (n: number | null | undefined, lo: number, hi: number) =>
  n == null || !isFinite(n) ? null : Math.min(hi, Math.max(lo, n));

/** Rydd og valider felter før lagring. */
export function sanitizeTrack<T extends Partial<Track>>(t: T): T {
  const out: Partial<Track> = { ...t };
  if (out.artist !== undefined) out.artist = out.artist.trim();
  if (out.title !== undefined) out.title = out.title.trim();
  if (out.version !== undefined) out.version = out.version.trim();
  if (out.camelot !== undefined) out.camelot = toCamelot(out.camelot);
  if (out.bpm !== undefined) out.bpm = out.bpm == null ? null : Math.round(clamp(out.bpm, 20, 300)! * 100) / 100;
  if (out.energy !== undefined) out.energy = out.energy == null ? null : Math.round(clamp(out.energy, 1, 10)!);
  if (out.rating !== undefined) out.rating = Math.round(clamp(out.rating, 0, 5) ?? 0);
  if (out.introBars !== undefined) out.introBars = clamp(out.introBars, 0, 512);
  if (out.outroBars !== undefined) out.outroBars = clamp(out.outroBars, 0, 512);
  if (out.tags !== undefined)
    out.tags = Array.from(new Set(out.tags.map((x) => x.trim().toLowerCase()).filter(Boolean)));
  return out as T;
}

export async function addTrack(input: NewTrack, database: DjDatabase = defaultDb): Promise<Track> {
  const now = new Date().toISOString();
  const base = sanitizeTrack({ ...emptyTrack(), ...input });
  const track: Track = {
    ...base,
    id: newId(),
    dupKey: makeDupKey(base.artist, base.title, base.version),
    createdAt: now,
    updatedAt: now,
  };
  await database.tracks.add(track);
  return track;
}

/** Legg til mange låter i én transaksjon. */
export async function addTracks(inputs: NewTrack[], database: DjDatabase = defaultDb): Promise<Track[]> {
  const now = new Date().toISOString();
  const tracks: Track[] = inputs.map((input) => {
    const base = sanitizeTrack({ ...emptyTrack(), ...input });
    return { ...base, id: newId(), dupKey: makeDupKey(base.artist, base.title, base.version), createdAt: now, updatedAt: now };
  });
  await database.tracks.bulkAdd(tracks);
  return tracks;
}

export async function updateTrack(id: string, changes: Partial<Track>, database: DjDatabase = defaultDb): Promise<void> {
  await database.transaction('rw', database.tracks, async () => {
    const existing = await database.tracks.get(id);
    if (!existing) throw new Error(`Fant ikke låt ${id}`);
    const merged = { ...existing, ...sanitizeTrack(changes), updatedAt: new Date().toISOString() };
    merged.dupKey = makeDupKey(merged.artist, merged.title, merged.version);
    await database.tracks.put(merged);
  });
}

export async function deleteTracks(ids: string[], database: DjDatabase = defaultDb): Promise<void> {
  await database.tracks.bulkDelete(ids);
}
