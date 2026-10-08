import type { NewTrack } from '../../db/types';

/**
 * Eksempellåter for å teste søk og filtre. BPM/key/energi er omtrentlige —
 * alle har taggen "sample", så de er enkle å finne og slette etterpå.
 */
type Row = [artist: string, title: string, version: string, bpm: number, key: string, energy: number, genre: string, subgenre: string, year: number, tags: string[], status?: 'wishlist'];

const rows: Row[] = [
  ['Paul van Dyk', 'For An Angel', 'PvD E-Werk Club Mix', 138, '8A', 8, 'Trance', 'Uplifting Trance', 1998, ['classic', 'peak time']],
  ['Energy 52', 'Café Del Mar', 'Three N One Remix', 134, '9A', 7, 'Trance', 'Balearic Trance', 1997, ['classic']],
  ['ATB', '9 PM (Till I Come)', 'Original', 130, '1A', 7, 'Trance', 'Vocal Trance', 1998, ['classic']],
  ['Chicane', 'Saltwater', 'Original Mix', 136, '6A', 7, 'Trance', 'Balearic Trance', 1999, ['vocal', 'classic']],
  ['Binary Finary', '1998', 'Gouryella Remix', 138, '11A', 9, 'Trance', 'Uplifting Trance', 1998, ['peak time', 'banger']],
  ['Robert Miles', 'Children', 'Dream Version', 137, '11A', 6, 'Trance', 'Dream Trance', 1995, ['classic', 'closer']],
  ['Sasha', 'Xpander', 'Original Mix', 135, '7A', 8, 'Trance', 'Progressive Trance', 1999, ['peak time']],
  ['Deadmau5', 'Strobe', 'Club Edit', 128, '6B', 6, 'Progressive House', '', 2009, ['closer', 'classic']],
  ['Eric Prydz', 'Opus', 'Original Mix', 126, '8A', 9, 'Progressive House', '', 2015, ['peak time']],
  ['Lane 8', 'Fingerprint', 'Original Mix', 122, '5A', 5, 'Progressive House', 'Melodic House', 2018, ['warm-up']],
  ['Yotto', 'The One You Left Behind', 'Original Mix', 123, '4A', 6, 'Progressive House', 'Melodic House', 2017, ['vocal']],
  ['Jeff Mills', 'The Bells', 'Original Mix', 136, '10A', 9, 'Techno', 'Detroit Techno', 1997, ['classic', 'banger']],
  ['Adam Beyer', 'Your Mind', 'Original Mix', 126, '5A', 8, 'Techno', 'Peak Time Techno', 2018, ['peak time']],
  ['Charlotte de Witte', 'Selected', 'Original Mix', 132, '4A', 9, 'Techno', 'Peak Time Techno', 2019, ['peak time', 'banger'], 'wishlist'],
  ['Mind Against', 'Atlant', 'Original Mix', 124, '9A', 7, 'Techno', 'Melodic Techno', 2014, []],
  ['Kerri Chandler', 'Rain', 'Original Mix', 122, '9A', 5, 'Deep House', '', 1998, ['warm-up', 'classic']],
  ['Larry Heard', 'Can You Feel It', 'Original', 120, '10A', 4, 'Deep House', 'Chicago House', 1986, ['warm-up', 'classic']],
  ['Moodymann', 'Shades of Jae', 'Original Mix', 118, '2A', 4, 'Deep House', '', 1999, ['warm-up']],
  ['Goldie', 'Inner City Life', 'Original', 87, '3A', 6, 'Drum & Bass', 'Liquid', 1994, ['vocal', 'classic']],
  ['Pendulum', 'Tarantula', 'Original Mix', 174, '9A', 9, 'Drum & Bass', 'Neurofunk', 2005, ['peak time']],
  ['High Contrast', 'If We Ever', 'Original Mix', 174, '11B', 7, 'Drum & Bass', 'Liquid', 2007, ['vocal']],
  ['Calibre', 'Mr Right On', 'Original Mix', 172, '7A', 6, 'Drum & Bass', 'Liquid', 2008, [], 'wishlist'],
  ['Donna Summer', 'I Feel Love', '12" Version', 124, '11A', 7, 'Disco & Pop', '80s/90s Disco', 1977, ['classic']],
  ['Chic', 'Le Freak', 'Original', 120, '8A', 7, 'Disco & Pop', 'Disco', 1978, ['classic', 'vocal']],
  ['Pet Shop Boys', 'West End Girls', 'Original', 113, '12A', 5, 'Disco & Pop', 'Synthpop', 1985, ['classic', 'vocal']],
  ['Haddaway', 'What Is Love', 'Original Mix', 124, '4A', 8, 'Eurodance', 'Eurodance 90s', 1993, ['vocal', 'classic']],
  ['Culture Beat', 'Mr. Vain', 'Original Mix', 133, '5A', 8, 'Eurodance', 'Eurodance 90s', 1993, ['vocal', 'classic']],
  ['2 Unlimited', 'No Limit', 'Extended Mix', 140, '6A', 9, 'Eurodance', 'Eurodance 90s', 1993, ['banger', 'classic']],
  ['Corona', 'The Rhythm of the Night', 'Original Mix', 125, '7A', 8, 'Eurodance', 'Eurodance 90s', 1993, ['vocal']],
  ['Paul van Dyk', 'For an Angel', 'PvD E-Werk Club Mix', 138, '8A', 8, 'Trance', 'Uplifting Trance', 1998, ['classic']],
];

export const SAMPLE_TRACKS: NewTrack[] = rows.map(([artist, title, version, bpm, camelot, energy, genre, subgenre, year, tags, status]) => ({
  artist,
  title,
  version,
  bpm,
  camelot,
  energy,
  genre,
  subgenre,
  year,
  tags: [...tags, 'sample'],
  status: status ?? 'owned',
  durationSec: 360 + ((artist.length * 37 + title.length * 11) % 180),
  introBars: 32,
  outroBars: 32,
  sources: { bpm: 'manual', camelot: 'manual' },
}));
