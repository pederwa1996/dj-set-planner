import { emptyTrack } from '../../db/tracks';
import type { Track } from '../../db/types';
import { makeDupKey } from '../../lib/normalize';
import { discoverBridges, discoverForSet, discoverReplacements, setSeedArtists, suggestGenre, type DiscoverDeps } from '../discover';

const t = (p: Partial<Track>): Track => {
  const base = { ...emptyTrack(), artist: 'A', title: 'T', ...p };
  return { ...base, id: Math.random().toString(), dupKey: makeDupKey(base.artist, base.title, base.version), createdAt: '', updatedAt: '' };
};

const from = t({ artist: 'Chicane', title: 'Saltwater', bpm: 134, camelot: '8A', energy: 6 });
const to = t({ artist: 'Paul van Dyk', title: 'For An Angel', bpm: 138, camelot: '10A', energy: 8 });
const owned = t({ artist: 'Ferry Corsten', title: 'Punk', bpm: 136, camelot: '9A' });

const DEEZER: Record<string, unknown> = {
  '/search/artist?limit=3&q=Chicane': { data: [{ id: 1, name: 'Chicane' }] },
  '/search/artist?limit=3&q=Paul%20van%20Dyk': { data: [{ id: 2, name: 'Paul van Dyk' }] },
  '/artist/1/related?limit=10': { data: [{ id: 10, name: 'Ferry Corsten' }, { id: 11, name: 'Solarstone' }] },
  '/artist/2/related?limit=10': { data: [{ id: 20, name: 'Armin van Buuren' }] },
  '/artist/1/top?limit=4': { data: [{ id: 101, title: 'Saltwater', title_short: 'Saltwater', artist: { name: 'Chicane' }, preview: 'p101' }] },
  '/artist/2/top?limit=4': { data: [] },
  '/artist/10/top?limit=4': { data: [{ id: 110, title: 'Punk', title_short: 'Punk', artist: { name: 'Ferry Corsten' } }, { id: 111, title: 'Out of the Blue', title_short: 'Out of the Blue', artist: { name: 'System F' } }] },
  '/artist/11/top?limit=4': { data: [{ id: 112, title: 'Seven Cities', title_short: 'Seven Cities', artist: { name: 'Solarstone' }, preview: 'p112' }] },
  '/artist/20/top?limit=4': { data: [{ id: 120, title: 'Blah Blah Blah', title_short: 'Blah Blah Blah', artist: { name: 'Armin van Buuren' } }] },
};
const ANALYSIS: Record<string, { bpm: number | null; camelot: string | null }> = {
  'Out of the Blue': { bpm: 136, camelot: '9A' }, // perfekt bro 8A → 9A → 10A
  'Seven Cities': { bpm: 135, camelot: '8A' },
  'Blah Blah Blah': { bpm: 130, camelot: '3B' }, // passer dårlig
};

function deps(log: string[] = []): DiscoverDeps {
  return {
    async deezer<T>(path: string) {
      log.push(path);
      if (!(path in DEEZER)) throw new Error('not found ' + path);
      return DEEZER[path] as T;
    },
    async analyse(x) {
      return ANALYSIS[x.title] ?? { bpm: null, camelot: null };
    },
  };
}

describe('brolåter fra nettet', () => {
  it('finner lignende artister, hopper over låter du har, og rangerer etter overgangene', async () => {
    const r = await discoverBridges(from, to, [from, to, owned], { deps: deps() });
    const titles = r.suggestions.map((s) => s.track.title);
    expect(titles[0]).toBe('Out of the Blue');
    expect(titles).toContain('Seven Cities');
    expect(titles).not.toContain('Blah Blah Blah'); // dårlig key
    expect(titles).not.toContain('Punk'); // finnes i biblioteket
    expect(titles).not.toContain('Saltwater'); // låten selv
    const best = r.suggestions[0];
    expect(best.track).toMatchObject({ bpm: 136, camelot: '9A', reason: 'similar to Chicane' });
    expect(best.into).toBeGreaterThanOrEqual(75);
    expect(r.suggestions.find((s) => s.track.title === 'Seven Cities')!.track.preview).toBe('p112');
  });

  it('fletter lignende artister fra begge sider av overgangen', async () => {
    const log: string[] = [];
    await discoverBridges(from, to, [], { deps: deps(log), maxArtists: 4 });
    const tops = log.filter((p) => p.endsWith('/top?limit=4')).map((p) => p.split('/')[2]);
    expect(tops).toEqual(['1', '2', '10', '20']);
  });

  it('kan stoppes, og gir beskjed når ingen key ble funnet', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const stopped = await discoverBridges(from, to, [], { deps: deps(), signal: ctrl.signal });
    expect(stopped.suggestions).toEqual([]);
    const noKeys = await discoverBridges(from, to, [], { deps: { ...deps(), analyse: async () => ({ bpm: 136, camelot: null }) } });
    expect(noKeys.notes.join()).toMatch(/GetSongBPM key/);
  });
});

describe('forslag til et set fra nettet', () => {
  const set = [
    t({ artist: 'Chicane', title: 'Saltwater', bpm: 134, camelot: '8A', energy: 6, genre: 'Trance' }),
    t({ artist: 'Chicane feat. Bryan Adams', title: "Don't Give Up", bpm: 132, camelot: '8A', genre: 'Trance' }),
    t({ artist: 'Paul van Dyk', title: 'For An Angel', bpm: 138, camelot: '10A', energy: 8, genre: 'Trance' }),
  ];
  const PLAYLISTS: Record<string, unknown> = {
    '/search/playlist?limit=10&q=trance': {
      data: [
        { id: 900, title: 'Chill vibes', nb_tracks: 50 },
        { id: 901, title: 'Trance Classics', nb_tracks: 80 },
        { id: 902, title: 'Uplifting Trance', nb_tracks: 40 },
      ],
    },
    '/playlist/901/tracks?limit=40': {
      data: [
        { id: 111, title: 'Out of the Blue', title_short: 'Out of the Blue', artist: { name: 'System F' }, preview: 'p111' },
        { id: 101, title: 'Saltwater', title_short: 'Saltwater', artist: { name: 'Chicane' } },
      ],
    },
    '/playlist/902/tracks?limit=40': { data: [{ id: 112, title: 'Seven Cities', title_short: 'Seven Cities', artist: { name: 'Solarstone' } }, { id: 120, title: 'Blah Blah Blah', title_short: 'Blah Blah Blah', artist: { name: 'Armin van Buuren' } }] },
    '/playlist/900/tracks?limit=40': { data: [{ id: 130, title: 'Unknown', title_short: 'Unknown', artist: { name: 'Nobody' } }] },
  };
  const genreDeps = (log: string[] = []): DiscoverDeps => ({
    ...deps(log),
    async deezer<T>(path: string) {
      log.push(path);
      path = path.replace(/\/top\?limit=\d+$/, '/top?limit=4');
      const all = { ...DEEZER, ...PLAYLISTS };
      if (!(path in all)) throw new Error('not found ' + path);
      return all[path] as T;
    },
  });

  it('velger artistene som går igjen mest, og vanligste sjanger', () => {
    expect(setSeedArtists(set)).toEqual(['Chicane', 'Paul van Dyk']);
    expect(suggestGenre(set)).toBe('Trance');
    expect(suggestGenre([], [t({ genre: 'House' })])).toBe('House');
    expect(suggestGenre([])).toBe('');
  });

  it('lignende artister: rangerer etter hvor godt låtene mikser med settet', async () => {
    const log: string[] = [];
    const r = await discoverForSet(set, set, { mode: 'similar', deps: genreDeps(log) });
    expect(log.filter((p) => p.includes('/top?')).every((p) => p.endsWith('limit=3'))).toBe(true);
    const titles = r.suggestions.map((s) => s.track.title);
    expect(titles).toContain('Out of the Blue');
    expect(titles).toContain('Seven Cities');
    expect(titles).not.toContain('Blah Blah Blah'); // 3B, 130 BPM: passer ikke
    expect(titles).not.toContain('Saltwater'); // finnes i biblioteket
    const seven = r.suggestions.find((s) => s.track.title === 'Seven Cities')!;
    expect(seven.fit).toBeGreaterThanOrEqual(75);
    expect(seven.matches).toBeGreaterThanOrEqual(2);
    expect(seven.best).toMatchObject({ camelot: '8A' });
    // sortert etter passform
    expect([...r.suggestions].sort((a, b) => b.fit! - a.fit!).map((s) => s.track.id)).toEqual(r.suggestions.map((s) => s.track.id));
  });

  it('sjanger: bruker de mest relevante spillelistene og fletter dem', async () => {
    const log: string[] = [];
    const r = await discoverForSet(set, set, { mode: 'genre', genre: 'trance', deps: genreDeps(log) });
    // Spillelister med «trance» i navnet først
    expect(log.filter((p) => p.startsWith('/playlist/')).map((p) => p.split('/')[2])).toEqual(['901', '902', '900']);
    const titles = r.suggestions.map((s) => s.track.title);
    expect(titles).toEqual(expect.arrayContaining(['Out of the Blue', 'Seven Cities']));
    expect(titles).not.toContain('Saltwater');
    expect(r.suggestions.find((s) => s.track.title === 'Out of the Blue')!.track).toMatchObject({ reason: 'in “Trance Classics”', preview: 'p111' });
    expect(r.notes.join()).toMatch(/1 track had no BPM or key online/);
    // En annen versjon av en låt du har, foreslås ikke
    const other = await discoverForSet(set, [...set, t({ artist: 'System F', title: 'Out of the Blue', version: 'Original Mix' })], { mode: 'genre', genre: 'trance', deps: genreDeps() });
    expect(other.suggestions.map((s) => s.track.title)).not.toContain('Out of the Blue');
  });

  it('tomt set: viser alle funn uten passform; ingen spillelister gir beskjed', async () => {
    const r = await discoverForSet([], [], { mode: 'genre', genre: 'trance', deps: genreDeps() });
    expect(r.suggestions.length).toBe(5);
    expect(r.suggestions.every((s) => s.fit === null)).toBe(true);
    const none = await discoverForSet([], [], { mode: 'genre', genre: 'polka', deps: { ...genreDeps(), deezer: async <T,>() => ({ data: [] }) as T } });
    expect(none.notes.join()).toMatch(/No playlists found for “polka”/);
  });
});

describe('bytte ut en låt med noe fra nettet', () => {
  it('bruker artistene rundt plassen og rangerer etter overgangene', async () => {
    const log: string[] = [];
    const current = t({ artist: 'Paul van Dyk', title: 'Weak One', bpm: 120, camelot: '3B' });
    const d: DiscoverDeps = { ...deps(log), deezer: async <T,>(path: string) => deps(log).deezer<T>(path.replace(/\/top\?limit=\d+$/, '/top?limit=4')) };
    const r = await discoverReplacements(from, to, current, [from, to, current, owned], { deps: d });
    expect(log.filter((p) => p.startsWith('/search/artist')).length).toBe(2); // Chicane og Paul van Dyk (én gang)
    const titles = r.suggestions.map((s) => s.track.title);
    expect(titles[0]).toBe('Out of the Blue');
    expect(titles).not.toContain('Punk');
    expect(titles).not.toContain('Blah Blah Blah');
    expect(r.suggestions[0]).toMatchObject({ into: expect.any(Number), out: expect.any(Number) });
  });
});
