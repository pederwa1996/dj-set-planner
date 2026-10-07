import type { Track, TrackStatus } from '../../db/types';
import { camelotSortValue, compatibleKeys, toCamelot } from '../../engine/camelot';
import { normalizeText } from '../../lib/normalize';

export interface LibraryFilter {
  query: string;
  bpmMin: number | null;
  bpmMax: number | null;
  /** Ta med låter på halv/dobbel tempo (f.eks. 87 når intervallet er 170–176) */
  bpmHalfDouble: boolean;
  keys: string[];
  /** Utvid valgte keys med harmonisk kompatible keys */
  keyCompatible: boolean;
  energyMin: number | null;
  energyMax: number | null;
  genres: string[];
  tags: string[];
  status: 'all' | TrackStatus;
  minRating: number;
  onlyDuplicates: boolean;
}

export const emptyFilter: LibraryFilter = {
  query: '',
  bpmMin: null,
  bpmMax: null,
  bpmHalfDouble: false,
  keys: [],
  keyCompatible: false,
  energyMin: null,
  energyMax: null,
  genres: [],
  tags: [],
  status: 'all',
  minRating: 0,
  onlyDuplicates: false,
};

export function activeFilterCount(f: LibraryFilter): number {
  let n = 0;
  if (f.bpmMin != null || f.bpmMax != null) n++;
  if (f.keys.length) n++;
  if (f.energyMin != null || f.energyMax != null) n++;
  if (f.genres.length) n++;
  if (f.tags.length) n++;
  if (f.status !== 'all') n++;
  if (f.minRating > 0) n++;
  if (f.onlyDuplicates) n++;
  return n;
}

export type SortColumn =
  | 'artist'
  | 'title'
  | 'version'
  | 'label'
  | 'year'
  | 'durationSec'
  | 'bpm'
  | 'camelot'
  | 'energy'
  | 'genre'
  | 'subgenre'
  | 'tags'
  | 'mood'
  | 'rating'
  | 'status'
  | 'playCount'
  | 'lastPlayedAt'
  | 'createdAt';

export interface SortSpec {
  column: SortColumn;
  dir: 'asc' | 'desc';
}

/** Antall låter per dupKey — alt > 1 er duplikat. */
export function duplicateCounts(tracks: Track[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tracks) m.set(t.dupKey, (m.get(t.dupKey) ?? 0) + 1);
  return m;
}

function searchHaystack(t: Track): string {
  return normalizeText(
    [t.artist, t.title, t.version, t.label, t.genre, t.subgenre, t.mood, t.notes, t.tags.join(' ')].join(' '),
  );
}

// Cache per låt-objekt; Dexie gir nye objekter når en låt endres
const haystackCache = new WeakMap<Track, string>();
function haystack(t: Track): string {
  let h = haystackCache.get(t);
  if (h === undefined) {
    h = searchHaystack(t);
    haystackCache.set(t, h);
  }
  return h;
}

export function bpmInRange(bpm: number, min: number | null, max: number | null, halfDouble: boolean): boolean {
  const lo = min ?? -Infinity;
  const hi = max ?? Infinity;
  const inside = (b: number) => b >= lo && b <= hi;
  if (inside(bpm)) return true;
  return halfDouble && (inside(bpm * 2) || inside(bpm / 2));
}

export function filterTracks(tracks: Track[], f: LibraryFilter, dupCounts?: Map<string, number>): Track[] {
  const phrase = normalizeText(f.query);
  const tokens = phrase.split(' ').filter(Boolean);
  // "8A", "Am", "A minor" osv. søker på key i stedet for tekst
  const queryKey = toCamelot(f.query);
  const keySet = f.keys.length
    ? new Set(f.keyCompatible ? f.keys.flatMap((k) => compatibleKeys(k)) : f.keys)
    : null;
  const genreSet = f.genres.length ? new Set(f.genres.map((g) => g.toLowerCase())) : null;
  const dups = f.onlyDuplicates ? (dupCounts ?? duplicateCounts(tracks)) : null;
  const hasBpm = f.bpmMin != null || f.bpmMax != null;
  const hasEnergy = f.energyMin != null || f.energyMax != null;

  return tracks.filter((t) => {
    if (f.status !== 'all' && t.status !== f.status) return false;
    if (hasBpm && (t.bpm == null || !bpmInRange(t.bpm, f.bpmMin, f.bpmMax, f.bpmHalfDouble))) return false;
    if (keySet && (!t.camelot || !keySet.has(t.camelot))) return false;
    if (hasEnergy) {
      if (t.energy == null) return false;
      if (f.energyMin != null && t.energy < f.energyMin) return false;
      if (f.energyMax != null && t.energy > f.energyMax) return false;
    }
    if (genreSet && !genreSet.has(t.genre.toLowerCase()) && !genreSet.has(t.subgenre.toLowerCase())) return false;
    if (f.tags.length && !f.tags.every((tag) => t.tags.includes(tag))) return false;
    if (f.minRating > 0 && t.rating < f.minRating) return false;
    if (dups && (dups.get(t.dupKey) ?? 0) < 2) return false;
    if (queryKey) {
      if (t.camelot !== queryKey && !haystack(t).includes(phrase)) return false;
    } else if (tokens.length) {
      const h = haystack(t);
      if (!tokens.every((tok) => h.includes(tok))) return false;
    }
    return true;
  });
}

const collator = new Intl.Collator('no', { sensitivity: 'base', numeric: true });

function sortValue(t: Track, c: SortColumn): string | number | null {
  switch (c) {
    case 'camelot':
      return t.camelot ? camelotSortValue(t.camelot) : null;
    case 'tags':
      return t.tags.length ? t.tags.join(', ') : null;
    case 'rating':
      return t.rating || null;
    default: {
      const v = t[c];
      return v === '' || v === undefined ? null : (v as string | number | null);
    }
  }
}

/** Tomme verdier havner alltid nederst, uansett retning. */
export function sortTracks(tracks: Track[], s: SortSpec): Track[] {
  const mult = s.dir === 'asc' ? 1 : -1;
  return [...tracks].sort((a, b) => {
    const va = sortValue(a, s.column);
    const vb = sortValue(b, s.column);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : collator.compare(String(va), String(vb));
    return cmp * mult || collator.compare(a.artist, b.artist) || collator.compare(a.title, b.title);
  });
}

/** Alle sjangre/undersjangre/tagger i biblioteket, til forslag i filtre og skjema. */
export function collectValues(tracks: Track[]) {
  const genres = new Set<string>();
  const subgenres = new Set<string>();
  const tags = new Set<string>();
  const moods = new Set<string>();
  for (const t of tracks) {
    if (t.genre) genres.add(t.genre);
    if (t.subgenre) subgenres.add(t.subgenre);
    if (t.mood) moods.add(t.mood);
    t.tags.forEach((x) => tags.add(x));
  }
  const sorted = (s: Set<string>) => [...s].sort(collator.compare);
  return { genres: sorted(genres), subgenres: sorted(subgenres), tags: sorted(tags), moods: sorted(moods) };
}
