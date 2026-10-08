import { DjDatabase } from '../../db/db';
import { addTrack, upsertImportedTracks } from '../../db/tracks';
import { parsePlaylistText, playlistNameFromFile } from '../playlistFile';

const EXPORTIFY = `"Track URI","Track Name","Artist Name(s)","Duration (ms)","Energy","Key","Mode","Tempo"
"spotify:track:1","Saltwater","Chicane","418000","0.7","7","0","136"
"spotify:track:2","Opus - Original Mix","Eric Prydz","543000","0.9","9","0","126"
"spotify:track:3","Saltwater","Chicane","418000","0.7","7","0","136"`;

describe('spillelistefil', () => {
  it('navn fra filnavn', () => {
    expect(playlistNameFromFile('saturday_warmup.csv')).toBe('Saturday warmup');
    expect(playlistNameFromFile('Peak Time 2026.csv')).toBe('Peak Time 2026');
    expect(playlistNameFromFile('.csv')).toBe('Imported playlist');
  });

  it('leser Exportify-CSV og tekstliste', () => {
    const csv = parsePlaylistText('warmup.csv', EXPORTIFY);
    expect(csv.tracks).toHaveLength(3);
    expect(csv.tracks[1]).toMatchObject({ artist: 'Eric Prydz', title: 'Opus', version: 'Original Mix', bpm: 126, camelot: '8A', energy: 9 });
    expect(csv.withData).toEqual({ bpm: 3, key: 3, energy: 3 });
    const txt = parsePlaylistText('list.txt', 'Chicane - Saltwater\nbad line');
    expect(txt.tracks).toHaveLength(1);
    expect(parsePlaylistText('x.txt', 'nothing useful').error).toMatch(/No “Artist - Title”/);
  });
});

describe('import uten duplikater', () => {
  it('gjenbruker eksisterende låter, fyller tomme felter og holder rekkefølgen', async () => {
    const db = new DjDatabase(`pl-${Math.random()}`);
    const old = await addTrack({ artist: 'Chicane', title: 'Saltwater', status: 'owned', notes: 'my note' }, db);
    const r = await upsertImportedTracks(parsePlaylistText('w.csv', EXPORTIFY).tracks, { status: 'wishlist' }, db);
    expect(r).toMatchObject({ created: 1, reused: 1, filled: 1 });
    expect(r.ids[0]).toBe(old.id);
    expect(r.ids).toHaveLength(2);
    const saltwater = await db.tracks.get(old.id);
    expect(saltwater).toMatchObject({ status: 'owned', notes: 'my note', bpm: 136, camelot: '6A' });
    const opus = await db.tracks.get(r.ids[1]);
    expect(opus).toMatchObject({ status: 'wishlist', bpm: 126 });
    await db.delete();
  });
});
