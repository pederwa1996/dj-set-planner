import { parseCsv, toCsv } from '../../lib/csv';
import { importCsv, spotifyKeyToCamelot } from '../csvImport';
import { parseTextList, splitVersion } from '../textList';

describe('CSV-parser', () => {
  it('håndterer anførselstegn, komma i felt og semikolon', () => {
    expect(parseCsv('a,b\n"x, y","sa ""hei"""\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'sa "hei"'],
    ]);
    expect(parseCsv('a;b\r\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('rundtur via toCsv', () => {
    const rows = [['Artist', 'Tittel'], ['A, B', 'Sang "x"']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe('innlimt liste', () => {
  it('tolker vanlige formater', () => {
    const r = parseTextList(`1. Paul van Dyk - For An Angel (PvD E-Werk Club Mix)
Chicane – Saltwater
Strobe by Deadmau5
https://open.spotify.com/track/abc
bare tull`);
    expect(r.map((x) => x.track)).toEqual([
      { artist: 'Paul van Dyk', title: 'For An Angel', version: 'PvD E-Werk Club Mix' },
      { artist: 'Chicane', title: 'Saltwater', version: '' },
      { artist: 'Deadmau5', title: 'Strobe', version: '' },
      null,
      null,
    ]);
    expect(r[3].problem).toMatch(/Exportify/);
  });
  it('tåler bindestrek i artistnavn', () => {
    expect(parseTextList('Jay-Z - 99 Problems')[0].track).toMatchObject({ artist: 'Jay-Z', title: '99 Problems' });
  });
  it('skiller ut versjon', () => {
    expect(splitVersion('Opus (Original Mix)')).toEqual({ title: 'Opus', version: 'Original Mix' });
    expect(splitVersion('Children [Dream Version]')).toEqual({ title: 'Children', version: 'Dream Version' });
    expect(splitVersion('Song (Live in Oslo)')).toEqual({ title: 'Song (Live in Oslo)', version: '' });
  });
});

describe('CSV-import', () => {
  it('leser Exportify-format med audio features', () => {
    const csv = `"Track URI","Track Name","Album Name","Artist Name(s)","Release Date","Duration (ms)","Popularity","Genres","Record Label","Danceability","Energy","Key","Loudness","Mode","Speechiness","Acousticness","Instrumentalness","Liveness","Valence","Tempo","Time Signature"
"spotify:track:1","For An Angel - PvD E-Werk Club Mix","Politics","Paul van Dyk","1998-01-01","443000","50","trance,uplifting trance","Vandit","0.6","0.85","9","-7","0","0.04","0.01","0.8","0.1","0.4","138.012","4"
"spotify:track:2","Strobe - Radio Edit","For Lack","deadmau5","2009-09-22","200000","60","","mau5trap","","","","","","","","","","","",""`;
    const r = importCsv(csv);
    expect(r.error).toBeUndefined();
    expect(r.tracks[0]).toMatchObject({
      artist: 'Paul van Dyk',
      title: 'For An Angel',
      version: 'PvD E-Werk Club Mix',
      bpm: 138.01,
      camelot: '8A',
      energy: 9,
      durationSec: 443,
      genre: 'trance',
      label: 'Vandit',
      year: 1998,
    });
    expect(r.tracks[1]).toMatchObject({ artist: 'deadmau5', title: 'Strobe', version: 'Radio Edit' });
    expect(r.tracks[1].bpm).toBeUndefined();
    expect(r.hasAudioFeatures).toEqual({ bpm: 1, key: 1, energy: 1 });
  });

  it('leser enkelt regneark med norske kolonner og vanlig key', () => {
    const r = importCsv('Artist;Tittel;BPM;Key;Lengde\nChicane;Saltwater;136;Gm;6:58');
    expect(r.tracks[0]).toMatchObject({ artist: 'Chicane', title: 'Saltwater', bpm: 136, camelot: '6A', durationSec: 418 });
  });

  it('gir feilmelding uten artist/tittel', () => {
    expect(importCsv('foo,bar\n1,2').error).toMatch(/artist and title/);
  });

  it('konverterer Spotify key/mode', () => {
    expect(spotifyKeyToCamelot('0', '1')).toBe('8B');
    expect(spotifyKeyToCamelot('9', '0')).toBe('8A');
    expect(spotifyKeyToCamelot('-1', '1')).toBeNull();
  });
});
