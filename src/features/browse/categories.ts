import type { Track } from '../../db/types';
import { camelotSortValue, camelotToMusical, compatibleKeys, harmonicCompatibility } from '../../engine/camelot';
import type { CategoryKind } from '../../lib/router';
import { needsCheck } from '../library/filter';

export const BPM_BUCKET = 5;

/** 127.5 → "125-130" */
export function bpmBucket(bpm: number): string {
  const lo = Math.floor(bpm / BPM_BUCKET) * BPM_BUCKET;
  return `${lo}-${lo + BPM_BUCKET}`;
}

/** 1997 → "1990" */
export const decadeOf = (year: number) => String(Math.floor(year / 10) * 10);

const ci = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function matchesCategory(t: Track, kind: CategoryKind, value: string): boolean {
  switch (kind) {
    case 'key':
      return t.camelot === value;
    case 'genre':
      return (!!t.genre && ci(t.genre, value)) || (!!t.subgenre && ci(t.subgenre, value));
    case 'bpm': {
      const [lo, hi] = value.split('-').map(Number);
      return t.bpm != null && t.bpm >= lo && t.bpm < hi;
    }
    case 'energy':
      return t.energy === Number(value);
    case 'tag':
      return t.tags.includes(value.toLowerCase());
    case 'mood':
      return !!t.mood && ci(t.mood, value);
    case 'decade': {
      const d = Number(value);
      return t.year != null && t.year >= d && t.year < d + 10;
    }
    case 'status':
      return t.status === value;
    case 'attention':
      if (value === 'check') return needsCheck(t);
      if (value === 'missing') return t.bpm == null || t.camelot == null;
      if (value === 'energy') return t.energy == null;
      return false;
  }
}

export function categoryTitle(kind: CategoryKind, value: string): string {
  switch (kind) {
    case 'key':
      return `${value} · ${camelotToMusical(value)}`;
    case 'bpm':
      return `${value.replace('-', '–')} BPM`;
    case 'energy':
      return `Energy ${value}`;
    case 'decade':
      return `${value}s`;
    case 'status':
      return value === 'wishlist' ? 'To get' : 'Owned';
    case 'attention':
      return value === 'check' ? 'Needs checking' : value === 'missing' ? 'Missing BPM or key' : 'Missing energy';
    case 'tag':
      return `#${value}`;
    default:
      return value;
  }
}

export const KIND_LABEL: Record<CategoryKind, string> = {
  key: 'Key',
  genre: 'Genre',
  bpm: 'Tempo',
  energy: 'Energy',
  tag: 'Tag',
  mood: 'Mood',
  decade: 'Decade',
  status: 'Status',
  attention: 'Needs attention',
};

export interface RelatedKey {
  camelot: string;
  label: string;
}

/** Keys som mikser godt med en key, med forklaring (samme rekkefølge som DJ-er tenker) */
export function relatedKeys(camelot: string): RelatedKey[] {
  const all = compatibleKeys(camelot, { includeBoosts: true, includeDiagonal: true }).filter((k) => k !== camelot);
  const label = (k: string) => {
    const h = harmonicCompatibility(camelot, k)!;
    switch (h.relation) {
      case 'adjacent':
        return h.step > 0 ? '+1 on the wheel' : '−1 on the wheel';
      case 'relative':
        return 'Relative major/minor';
      case 'diagonal':
        return 'Diagonal mix';
      case 'boost2':
        return 'Energy boost (+2)';
      case 'boost7':
        return 'Energy boost (+7)';
      default:
        return h.label;
    }
  };
  return all.map((k) => ({ camelot: k, label: label(k) }));
}

/** Teller per kategori, til Browse-siden */
export function summarize(tracks: Track[]) {
  const inc = (m: Map<string, number>, k: string | null | undefined) => {
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  };
  const keys = new Map<string, number>();
  const genres = new Map<string, number>();
  const bpm = new Map<string, number>();
  const energy = new Map<string, number>();
  const tags = new Map<string, number>();
  const moods = new Map<string, number>();
  const decades = new Map<string, number>();
  const genreName = new Map<string, string>();
  for (const t of tracks) {
    inc(keys, t.camelot);
    if (t.genre) {
      const k = t.genre.trim().toLowerCase();
      if (!genreName.has(k)) genreName.set(k, t.genre.trim());
      inc(genres, genreName.get(k));
    }
    if (t.bpm != null) inc(bpm, bpmBucket(t.bpm));
    if (t.energy != null) inc(energy, String(t.energy));
    t.tags.forEach((x) => inc(tags, x));
    inc(moods, t.mood?.trim());
    if (t.year != null) inc(decades, decadeOf(t.year));
  }
  const byCount = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const byNum = (m: Map<string, number>) => [...m.entries()].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
  return {
    keys,
    genres: byCount(genres),
    bpm: byNum(bpm),
    energy: byNum(energy),
    tags: byCount(tags),
    moods: byCount(moods),
    decades: byNum(decades),
    keysSorted: [...keys.entries()].sort((a, b) => camelotSortValue(a[0]) - camelotSortValue(b[0])),
  };
}
