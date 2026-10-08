import { emptyTrack } from '../../db/tracks';
import type { Track } from '../../db/types';
import { makeDupKey } from '../../lib/normalize';
import { discoverBridges, type DiscoverDeps } from '../discover';

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
