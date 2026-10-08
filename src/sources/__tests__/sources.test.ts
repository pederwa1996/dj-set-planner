import { parseGetSongBpmSearch } from '../getsongbpm';
import { parseDeezerTrack } from '../deezer';
import { parseMusicBrainz } from '../musicbrainz';
import { changesFromSuggestion, mergeCandidates } from '../lookup';
import { matchScore, similarity } from '../match';
import { emptyCandidate, type Candidate } from '../types';
import { emptyTrack } from '../../db/tracks';
import type { Track } from '../../db/types';

const q = { artist: 'Paul van Dyk', title: 'For An Angel', version: '' };

describe('matching', () => {
  it('likhet på ord', () => {
    expect(similarity('For An Angel', 'for an angel')).toBe(1);
    expect(similarity('Strobe', 'Ghosts n Stuff')).toBe(0);
  });
  it('remix av samme låt scorer lavere enn originalen', () => {
    const orig = matchScore(q, { artist: 'Paul van Dyk', title: 'For An Angel', version: '' });
    const radio = matchScore(q, { artist: 'Paul van Dyk', title: 'For An Angel', version: 'Radio Edit' });
    const remix = matchScore(q, { artist: 'Paul van Dyk', title: 'For An Angel', version: 'Ferry Corsten Remix' });
    expect(orig).toBe(1);
    expect(radio).toBe(1);
    expect(matchScore({ ...q, version: 'Remastered 2009' }, { artist: 'Paul van Dyk', title: 'For An Angel' })).toBe(1);
    expect(remix).toBeLessThan(0.8);
  });
  it('godtar artist i samarbeid', () => {
    expect(matchScore({ artist: 'Above & Beyond', title: 'Sun & Moon' }, { artist: 'Above & Beyond, Richard Bedford', title: 'Sun & Moon' })).toBeGreaterThan(0.85);
  });
  it('feil artist gir lav score', () => {
    expect(matchScore(q, { artist: 'Someone Else', title: 'For An Angel' })).toBeLessThan(0.6);
  });
});

describe('parsing av API-svar', () => {
  it('GetSongBPM-søk', () => {
    const json = {
      search: [
        { id: 'x1', title: 'For an Angel', uri: 'https://getsongbpm.com/song/x1', tempo: '138', time_sig: '4/4', key_of: 'Am', open_key: '1m', artist: { name: 'Paul van Dyk', genres: ['trance'] }, album: { title: 'Seven Ways', year: '1996' } },
        { id: 'x2', title: 'Angel', tempo: '120', key_of: 'C', artist: { name: 'Other' } },
      ],
    };
    const r = parseGetSongBpmSearch(json, q);
    expect(r[0]).toMatchObject({ source: 'getsongbpm', bpm: 138, camelot: '8A', year: 1996, genre: 'trance' });
    expect(r[0].confidence).toBe(1);
    expect(parseGetSongBpmSearch({ search: { error: 'no result' } }, q)).toEqual([]);
  });
  it('GetSongBPM med key_of med ♭ og uten open_key', () => {
    const r = parseGetSongBpmSearch({ search: [{ id: '1', title: 'X', tempo: 128, key_of: 'E♭m', artist: { name: 'Y' } }] }, { artist: 'Y', title: 'X' });
    expect(r[0].camelot).toBe('2A');
  });
  it('Deezer-track (bpm 0 = ukjent)', () => {
    const c = parseDeezerTrack({ id: 1, title: 'For An Angel (PvD E-Werk Club Mix)', title_short: 'For An Angel', title_version: '(PvD E-Werk Club Mix)', duration: 443, bpm: 0, release_date: '1998-03-01', artist: { name: 'Paul van Dyk' }, album: { title: 'Politics' } }, { ...q, version: 'PvD E-Werk Club Mix' });
    expect(c).toMatchObject({ version: 'PvD E-Werk Club Mix', bpm: null, durationSec: 443, year: 1998 });
    expect(c.confidence).toBe(1);
  });
  it('MusicBrainz-opptak', () => {
    const r = parseMusicBrainz({ recordings: [{ id: 'm1', title: 'For an Angel (PvD E‐Werk club mix)', length: 443000, 'first-release-date': '1994', 'artist-credit': [{ name: 'Paul van Dyk', joinphrase: '' }], releases: [{ title: 'Politics' }] }] }, { ...q, version: 'PvD E-Werk Club Mix' });
    expect(r[0]).toMatchObject({ title: 'For an Angel', durationSec: 443, year: 1994 });
    expect(r[0].confidence).toBeGreaterThan(0.9);
  });
});

function cand(p: Partial<Candidate> & Pick<Candidate, 'source'>): Candidate {
  return { ...emptyCandidate(p.source, '1'), artist: 'Paul van Dyk', title: 'For An Angel', confidence: 1, ...p };
}

describe('sammenslåing', () => {
  it('kombinerer felter fra flere kilder og bekrefter BPM', () => {
    const s = mergeCandidates(q, [
      cand({ source: 'getsongbpm', bpm: 138, camelot: '8A', year: 1996 }),
      cand({ source: 'deezer', bpm: 138.1, durationSec: 443, label: 'Vandit', year: 1998 }),
      cand({ source: 'musicbrainz', durationSec: 440, year: 1994 }),
    ]);
    expect(s).toMatchObject({ bpm: 138, camelot: '8A', durationSec: 443, label: 'Vandit', year: 1994 });
    expect(s.from).toMatchObject({ bpm: 'getsongbpm', camelot: 'getsongbpm', durationSec: 'deezer', year: 'musicbrainz' });
    expect(s.info.status).toBe('ok');
    expect(s.info.notes.join()).toMatch(/confirmed/);
  });
  it('flagger half/double time-uenighet som usikkert', () => {
    const s = mergeCandidates(q, [cand({ source: 'getsongbpm', bpm: 87, camelot: '3A' }), cand({ source: 'deezer', bpm: 174 })]);
    expect(s.info.status).toBe('uncertain');
    expect(s.info.notes.join()).toMatch(/Half\/double/);
  });
  it('ignorerer dårlige treff og gir notfound', () => {
    const s = mergeCandidates(q, [cand({ source: 'deezer', artist: 'Noen andre', title: 'Noe annet', confidence: 0.2, bpm: 120 })]);
    expect(s.info.status).toBe('notfound');
    expect(s.bpm).toBeNull();
  });
  it('fill-empty overskriver ikke det du har satt selv', () => {
    const t = { ...emptyTrack(), id: '1', dupKey: '', createdAt: '', updatedAt: '', artist: 'A', title: 'B', bpm: 140, sources: { bpm: 'manual' } } as Track;
    const s = mergeCandidates(q, [cand({ source: 'getsongbpm', bpm: 138, camelot: '8A' })]);
    const ch = changesFromSuggestion(t, s, 'fill-empty');
    expect(ch.bpm).toBeUndefined();
    expect(ch.camelot).toBe('8A');
    expect(ch.sources).toEqual({ bpm: 'manual', camelot: 'online' });
    expect(changesFromSuggestion(t, s, 'overwrite').bpm).toBe(138);
  });
});
