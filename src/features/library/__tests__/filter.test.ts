import type { Track } from '../../../db/types';
import { emptyTrack } from '../../../db/tracks';
import { makeDupKey } from '../../../lib/normalize';
import { duplicateCounts, emptyFilter, filterTracks, sortTracks, type LibraryFilter } from '../filter';

let n = 0;
function t(p: Partial<Track>): Track {
  const base = { ...emptyTrack(), artist: 'A', title: 'T', ...p };
  return {
    ...base,
    id: String(++n),
    dupKey: makeDupKey(base.artist, base.title, base.version),
    createdAt: '',
    updatedAt: '',
  };
}

const lib = [
  t({ artist: 'Paul van Dyk', title: 'For An Angel', bpm: 138, camelot: '8A', energy: 8, genre: 'Trance', tags: ['klassiker', 'peak time'] }),
  t({ artist: 'Kerri Chandler', title: 'Rain', bpm: 122, camelot: '9A', energy: 5, genre: 'Deep House', tags: ['warm-up'] }),
  t({ artist: 'Goldie', title: 'Inner City Life', bpm: 87, camelot: '3A', energy: 6, genre: 'Drum & Bass', status: 'wishlist' }),
  t({ artist: 'Röyksopp', title: 'Eple', bpm: null, camelot: null, energy: null, genre: 'Downtempo' }),
  t({ artist: 'Paul van Dyk', title: 'For an Angel (Original Mix)', bpm: 138, camelot: '8A', energy: 8, genre: 'Trance' }),
];

const f = (p: Partial<LibraryFilter>) => filterTracks(lib, { ...emptyFilter, ...p });

describe('filtrering', () => {
  it('søker i flere felt, ignorerer aksenter og store bokstaver', () => {
    expect(f({ query: 'royksopp' }).map((x) => x.title)).toEqual(['Eple']);
    expect(f({ query: 'angel dyk' })).toHaveLength(2);
    expect(f({ query: 'a minor' })).toHaveLength(2);
    expect(f({ query: '9a' }).map((x) => x.artist)).toEqual(['Kerri Chandler']);
  });

  it('BPM-intervall, med og uten half/double time', () => {
    expect(f({ bpmMin: 170, bpmMax: 176 })).toHaveLength(0);
    expect(f({ bpmMin: 170, bpmMax: 176, bpmHalfDouble: true }).map((x) => x.artist)).toEqual(['Goldie']);
    expect(f({ bpmMin: 120, bpmMax: 125 })).toHaveLength(1);
  });

  it('key, eventuelt med kompatible keys', () => {
    expect(f({ keys: ['8A'] })).toHaveLength(2);
    expect(f({ keys: ['8A'], keyCompatible: true })).toHaveLength(3);
  });

  it('energi, sjanger, tagger og status', () => {
    expect(f({ energyMin: 7 })).toHaveLength(2);
    expect(f({ genres: ['deep house'] })).toHaveLength(1);
    expect(f({ tags: ['klassiker', 'peak time'] })).toHaveLength(1);
    expect(f({ status: 'wishlist' })).toHaveLength(1);
  });

  it('finner duplikater (Original Mix regnes som samme låt)', () => {
    expect(duplicateCounts(lib).get(lib[0].dupKey)).toBe(2);
    expect(f({ onlyDuplicates: true })).toHaveLength(2);
  });
});

describe('sortering', () => {
  it('sorterer på BPM med tomme verdier nederst i begge retninger', () => {
    expect(sortTracks(lib, { column: 'bpm', dir: 'asc' }).map((x) => x.bpm)).toEqual([87, 122, 138, 138, null]);
    expect(sortTracks(lib, { column: 'bpm', dir: 'desc' }).map((x) => x.bpm)).toEqual([138, 138, 122, 87, null]);
  });

  it('sorterer Camelot etter hjulet', () => {
    expect(sortTracks(lib, { column: 'camelot', dir: 'asc' }).map((x) => x.camelot)).toEqual(['3A', '8A', '8A', '9A', null]);
  });
});

describe('dupKey', () => {
  it('normaliserer feat., tegnsetting og versjon', () => {
    expect(makeDupKey('Artist feat. X', 'Song')).toBe(makeDupKey('Artist', 'Song'));
    expect(makeDupKey('A & B', 'Song!')).toBe(makeDupKey('A and B', 'song'));
    expect(makeDupKey('A', 'Song (Club Mix)')).toBe(makeDupKey('A', 'Song', 'Club Mix'));
    expect(makeDupKey('A', 'Song', 'Club Mix')).not.toBe(makeDupKey('A', 'Song', 'Dub Mix'));
  });
});
