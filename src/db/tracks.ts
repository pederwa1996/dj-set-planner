import { addTombstones, db as defaultDb, type DjDatabase } from './db';
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

export interface UpsertResult {
  /** Låtenes id-er i filens rekkefølge (uten doble) */
  ids: string[];
  created: number;
  reused: number;
  /** Eksisterende låter som fikk manglende BPM/key/energi fra filen */
  filled: number;
}

/**
 * Legg inn låter fra en spilleliste uten å lage duplikater: finnes låten allerede
 * (samme artist/tittel/versjon), gjenbrukes den — og tomme felter fylles fra filen.
 */
export async function upsertImportedTracks(inputs: NewTrack[], opts: { status: Track['status']; tags?: string[] }, database: DjDatabase = defaultDb): Promise<UpsertResult> {
  const now = new Date().toISOString();
  const existing = new Map((await database.tracks.toArray()).map((t) => [t.dupKey, t]));
  const seen = new Set<string>();
  const ids: string[] = [];
  const toAdd: Track[] = [];
  const toUpdate: Track[] = [];
  let reused = 0;
  for (const input of inputs) {
    const base = sanitizeTrack({ ...emptyTrack(), ...input, status: opts.status, tags: Array.from(new Set([...(input.tags ?? []), ...(opts.tags ?? [])])) });
    const dupKey = makeDupKey(base.artist, base.title, base.version);
    if (seen.has(dupKey)) continue;
    seen.add(dupKey);
    const old = existing.get(dupKey);
    if (old) {
      reused++;
      ids.push(old.id);
      const fill: Partial<Track> = {};
      const sources = { ...old.sources };
      if (old.bpm == null && base.bpm != null) {
        fill.bpm = base.bpm;
        sources.bpm = 'import';
      }
      if (!old.camelot && base.camelot) {
        fill.camelot = base.camelot;
        sources.camelot = 'import';
      }
      if (old.energy == null && base.energy != null) fill.energy = base.energy;
      if (old.durationSec == null && base.durationSec != null) fill.durationSec = base.durationSec;
      if (old.year == null && base.year != null) fill.year = base.year;
      if (!old.label && base.label) fill.label = base.label;
      if (!old.genre && base.genre) fill.genre = base.genre;
      if (Object.keys(fill).length) toUpdate.push({ ...old, ...fill, sources, updatedAt: now });
      continue;
    }
    const t: Track = { ...base, id: newId(), dupKey, createdAt: now, updatedAt: now };
    toAdd.push(t);
    ids.push(t.id);
  }
  await database.transaction('rw', database.tracks, async () => {
    if (toAdd.length) await database.tracks.bulkAdd(toAdd);
    if (toUpdate.length) await database.tracks.bulkPut(toUpdate);
  });
  return { ids, created: toAdd.length, reused, filled: toUpdate.length };
}

export async function updateTrack(id: string, changes: Partial<Track>, database: DjDatabase = defaultDb): Promise<void> {
  await database.transaction('rw', database.tracks, async () => {
    const existing = await database.tracks.get(id);
    if (!existing) throw new Error(`Track ${id} not found`);
    const merged = { ...existing, ...sanitizeTrack(changes), updatedAt: new Date().toISOString() };
    merged.dupKey = makeDupKey(merged.artist, merged.title, merged.version);
    await database.tracks.put(merged);
  });
}

export async function deleteTracks(ids: string[], database: DjDatabase = defaultDb): Promise<void> {
  await database.transaction('rw', database.tracks, database.tombstones, async () => {
    await database.tracks.bulkDelete(ids);
    await addTombstones(database, 'track', ids);
  });
}
