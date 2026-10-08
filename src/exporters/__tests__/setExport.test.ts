import { emptyTrack } from '../../db/tracks';
import { emptySet, pairKey } from '../../db/sets';
import type { Track } from '../../db/types';
import { analyzeSet } from '../../engine/analysis';
import { parseCsv } from '../../lib/csv';
import { safeFilename, setToCsv, setToText, shopLinks } from '../setExport';

const t = (id: string, p: Partial<Track>): Track => ({ ...emptyTrack(), id, dupKey: '', createdAt: '', updatedAt: '', artist: 'A', title: 'T', ...p });

const a = t('a', { artist: 'Chicane', title: 'Saltwater', bpm: 136, camelot: '6A', energy: 6, durationSec: 418 });
const b = t('b', { artist: 'Paul van Dyk', title: 'For An Angel', version: 'PvD E-Werk Club Mix', bpm: 138, camelot: '7A', energy: 8, durationSec: 443 });

it('tekstliste for Spotify-verktøy', () => {
  expect(setToText([a, b])).toBe('Chicane - Saltwater\nPaul van Dyk - For An Angel (PvD E-Werk Club Mix)');
  expect(setToText([a], { numbered: true })).toBe('1. Chicane - Saltwater');
});

it('CSV med overganger og notater', () => {
  const set = { ...emptySet('Lørdag'), transitionNotes: { [pairKey('a', 'b')]: 'filter ut bassen' } };
  const rows = parseCsv(setToCsv(set, [a, b], analyzeSet([a, b], { curve: set.curve })));
  expect(rows[0][0]).toBe('#');
  expect(rows[1].slice(0, 7)).toEqual(['1', '0:00', 'Chicane', 'Saltwater', '', '136', '6A']);
  expect(rows[1][11]).toMatch(/^6A → 7A: \+1 on the wheel/);
  expect(rows[1][13]).toBe('filter ut bassen');
  expect(rows[2][1]).toBe('6:58');
});

it('søkelenker og filnavn', () => {
  const links = shopLinks(b);
  expect(links.map((l) => l.name)).toEqual(['Beatport', 'Bandcamp', 'Traxsource', 'YouTube', 'Spotify']);
  expect(links[0].url).toBe('https://www.beatport.com/search?q=Paul%20van%20Dyk%20For%20An%20Angel%20PvD%20E-Werk%20Club%20Mix');
  expect(safeFilename('Lørdag @ Blå: 22/10')).toBe('Lørdag-Blå-2210');
});
