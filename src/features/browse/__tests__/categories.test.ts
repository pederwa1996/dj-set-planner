import { emptyTrack } from '../../../db/tracks';
import type { Track } from '../../../db/types';
import { bpmBucket, categoryTitle, decadeOf, matchesCategory, relatedKeys, summarize } from '../categories';

const t = (p: Partial<Track>): Track => ({ ...emptyTrack(), id: Math.random().toString(), dupKey: '', createdAt: '', updatedAt: '', artist: 'A', title: 'T', ...p });

it('BPM-bøtter og tiår', () => {
  expect(bpmBucket(127.5)).toBe('125-130');
  expect(bpmBucket(125)).toBe('125-130');
  expect(bpmBucket(124.99)).toBe('120-125');
  expect(decadeOf(1997)).toBe('1990');
});

it('matcher kategorier', () => {
  const x = t({ camelot: '8A', genre: 'Trance', subgenre: 'Uplifting Trance', bpm: 138, energy: 8, tags: ['classic'], mood: 'Euphoric', year: 1998, status: 'wishlist' });
  expect(matchesCategory(x, 'key', '8A')).toBe(true);
  expect(matchesCategory(x, 'key', '9A')).toBe(false);
  expect(matchesCategory(x, 'genre', 'trance')).toBe(true);
  expect(matchesCategory(x, 'genre', 'Uplifting Trance')).toBe(true);
  expect(matchesCategory(x, 'bpm', '135-140')).toBe(true);
  expect(matchesCategory(x, 'energy', '8')).toBe(true);
  expect(matchesCategory(x, 'tag', 'classic')).toBe(true);
  expect(matchesCategory(x, 'mood', 'euphoric')).toBe(true);
  expect(matchesCategory(x, 'decade', '1990')).toBe(true);
  expect(matchesCategory(x, 'status', 'wishlist')).toBe(true);
  expect(matchesCategory(t({ bpm: null }), 'attention', 'missing')).toBe(true);
  expect(matchesCategory(t({ energy: null }), 'attention', 'energy')).toBe(true);
});

it('titler', () => {
  expect(categoryTitle('key', '8A')).toBe('8A · A minor');
  expect(categoryTitle('bpm', '120-125')).toBe('120–125 BPM');
  expect(categoryTitle('decade', '1990')).toBe('1990s');
  expect(categoryTitle('status', 'wishlist')).toBe('To get');
});

it('relaterte keys med forklaring', () => {
  const r = relatedKeys('8A');
  expect(r.map((x) => x.camelot)).toEqual(['9A', '7A', '8B', '9B', '10A', '3A']);
  expect(r.find((x) => x.camelot === '8B')!.label).toBe('Relative major/minor');
  expect(r.find((x) => x.camelot === '3A')!.label).toBe('Energy boost (+7)');
});

it('oppsummerer biblioteket', () => {
  const s = summarize([t({ camelot: '8A', genre: 'Trance', bpm: 138 }), t({ camelot: '8A', genre: 'trance', bpm: 122 }), t({ camelot: '1B', genre: 'House', bpm: 124 })]);
  expect(s.keys.get('8A')).toBe(2);
  expect(s.genres).toEqual([
    ['Trance', 2],
    ['House', 1],
  ]);
  expect(s.bpm.map((x) => x[0])).toEqual(['120-125', '135-140']);
  expect(s.keysSorted.map((x) => x[0])).toEqual(['1B', '8A']);
});
