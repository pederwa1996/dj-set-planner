import { analyzeSet } from '../analysis';
import { findBridges, findReplacements, idealBridge, idealReplacement } from '../bridge';
import { energyAt, presetCurve } from '../energy';
import { buildSequences, primaryArtist } from '../sequencer';
import { tempoCompatibility } from '../tempo';
import { scoreTransition } from '../transition';
import type { MixTrack } from '../types';

let n = 0;
const tr = (p: Partial<MixTrack>): MixTrack => ({ id: `t${++n}`, artist: `Artist ${n}`, title: `Track ${n}`, bpm: 128, camelot: '8A', energy: 6, durationSec: 360, ...p });

describe('tempo', () => {
  it('liten endring', () => {
    const r = tempoCompatibility(126, 128);
    expect(r.mode).toBe('same');
    expect(r.delta).toBe(2);
    expect(r.pct).toBeCloseTo(1.587, 2);
    expect(r.score).toBe(0.95);
    expect(r.label).toBe('+2 BPM (1.6%)');
  });
  it('half/double time', () => {
    expect(tempoCompatibility(174, 87).mode).toBe('half');
    expect(tempoCompatibility(87, 174).mode).toBe('double');
    expect(tempoCompatibility(87, 174).score).toBeCloseTo(0.85);
    expect(tempoCompatibility(87, 174).label).toMatch(/half\/double-time 87 ↔ 174/);
  });
  it('stort hopp gir lav score', () => {
    const r = tempoCompatibility(124, 140);
    expect(r.score).toBeLessThan(0.3);
    expect(r.label).toMatch(/big tempo jump/);
  });
});

describe('overganger', () => {
  it('8A → 9A med +2 BPM er perfekt eller god, med forklaring', () => {
    const s = scoreTransition(tr({ camelot: '8A', bpm: 126, energy: 6 }), tr({ camelot: '9A', bpm: 128, energy: 7 }));
    expect(s.grade).toBe('good');
    expect(s.explanation).toBe('8A → 9A: +1 on the wheel · +2 BPM (1.6%) · energy 6 → 7 — perfect');
  });
  it('key-kræsj blir aldri «god»', () => {
    const s = scoreTransition(tr({ camelot: '8A' }), tr({ camelot: '2B' }));
    expect(s.grade).not.toBe('good');
    expect(s.issues).toContain('key clash');
  });
  it('stort tempohopp blir rødt, og forklaringen sier det samme', () => {
    const s = scoreTransition(tr({ bpm: 122 }), tr({ bpm: 140 }));
    expect(s.grade).toBe('bad');
    expect(s.explanation).toMatch(/— tricky$/);
  });
  it('brått energihopp flagges', () => {
    expect(scoreTransition(tr({ energy: 3 }), tr({ energy: 8 })).issues.join()).toMatch(/energy jump/);
  });
  it('manglende data gir nøytral score og beskjed', () => {
    const s = scoreTransition(tr({ camelot: null, bpm: null }), tr({}));
    expect(s.issues).toEqual(['missing key', 'missing BPM']);
    expect(s.grade).toBe('ok');
  });
});

describe('energikurver', () => {
  it('interpolerer', () => {
    const c = presetCurve('build');
    expect(energyAt(c, 0)).toBe(3);
    expect(energyAt(c, 0.5)).toBe(6);
    expect(energyAt(c, 1)).toBe(9);
    expect(energyAt(presetCurve('warmup-peak-close'), 0.8)).toBe(9);
  });
});

describe('sequencer', () => {
  const flat = presetCurve('flat');

  it('går rundt hjulet i stedet for å hoppe', () => {
    const keys = ['10A', '8A', '12A', '9A', '11A'];
    const pool = keys.map((k) => tr({ camelot: k }));
    const [best] = buildSequences(pool, { curve: flat });
    const order = best.order.map((id) => pool.find((t) => t.id === id)!.camelot);
    expect([['8A', '9A', '10A', '11A', '12A'], ['12A', '11A', '10A', '9A', '8A']]).toContainEqual(order);
    expect(best.minScore).toBeGreaterThanOrEqual(75);
  });

  it('følger en oppbyggende energikurve og BPM', () => {
    const pool = [5, 3, 9, 7, 4, 8, 6].map((e) => tr({ energy: e, bpm: 120 + e }));
    const [best] = buildSequences(pool, { curve: presetCurve('build') });
    expect(best.order.map((id) => pool.find((t) => t.id === id)!.energy)).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });

  it('respekterer låste posisjoner', () => {
    const pool = ['8A', '9A', '10A', '11A', '12A', '1A'].map((k) => tr({ camelot: k }));
    const res = buildSequences(pool, { curve: flat, locks: [{ trackId: pool[5].id, position: 'first' }, { trackId: pool[2].id, position: 'last' }, { trackId: pool[0].id, position: 2 }] });
    for (const r of res) {
      expect(r.order[0]).toBe(pool[5].id);
      expect(r.order[r.order.length - 1]).toBe(pool[2].id);
      expect(r.order[2]).toBe(pool[0].id);
      expect(r.order).toHaveLength(6);
    }
  });

  it('velger et utvalg som passer ønsket lengde', () => {
    const pool = Array.from({ length: 20 }, (_, i) => tr({ camelot: `${(i % 12) + 1}A`, durationSec: 300 }));
    const [best] = buildSequences(pool, { curve: flat, targetSec: 60 * 60 });
    expect(best.order.length).toBeGreaterThanOrEqual(11);
    expect(best.order.length).toBeLessThanOrEqual(13);
    expect(Math.abs(best.totalSec - 3600)).toBeLessThanOrEqual(300);
  });

  it('gir flere forskjellige alternativer', () => {
    const pool = Array.from({ length: 10 }, (_, i) => tr({ camelot: `${(i % 6) + 7}${i % 2 ? 'A' : 'B'}`, energy: 3 + (i % 6), bpm: 124 + (i % 4) }));
    const res = buildSequences(pool, { curve: presetCurve('warmup-peak-close'), alternatives: 3 });
    expect(res.length).toBe(3);
    expect(new Set(res.map((r) => r.order.join())).size).toBe(3);
    expect(res[0].cost).toBeLessThanOrEqual(res[1].cost);
  });

  it('holder samme artist fra hverandre når det går', () => {
    const pool = [tr({ artist: 'Eric Prydz' }), tr({ artist: 'Eric Prydz feat. X' }), tr({}), tr({}), tr({})];
    const [best] = buildSequences(pool, { curve: flat, artistGap: 2 });
    const pos = best.order.map((id) => primaryArtist(pool.find((t) => t.id === id)!.artist));
    const i = pos.indexOf('eric prydz');
    const j = pos.lastIndexOf('eric prydz');
    expect(j - i).toBeGreaterThan(2);
  });

  it('primærartist', () => {
    expect(primaryArtist('Above & Beyond feat. Zoë Johnston')).toBe('above');
    expect(primaryArtist('X')).toBe('x');
    expect(primaryArtist('Malcolm X')).toBe('malcolm x');
    expect(primaryArtist('Skrillex x Diplo')).toBe('skrillex');
  });

  it('er rask nok for 120 låter', () => {
    const pool = Array.from({ length: 120 }, (_, i) => tr({ camelot: `${(i % 12) + 1}${i % 3 ? 'A' : 'B'}`, bpm: 120 + (i % 15), energy: 1 + (i % 10) }));
    const t0 = Date.now();
    const res = buildSequences(pool, { curve: presetCurve('waves'), targetSec: 90 * 60 });
    expect(res.length).toBeGreaterThan(0);
    expect(Date.now() - t0).toBeLessThan(8000);
  });

  it('tom pott gir tomt resultat', () => {
    expect(buildSequences([], { curve: flat })).toEqual([]);
  });
});

describe('analyse og brolåter', () => {
  it('regner ut starttider, hull og advarsler', () => {
    const a = tr({ artist: 'X', camelot: '8A', bpm: 124, durationSec: 300 });
    const b = tr({ artist: 'X', camelot: '2B', bpm: 140, durationSec: 300 });
    const r = analyzeSet([a, b], { curve: presetCurve('flat') });
    expect(r.items.map((i) => i.startSec)).toEqual([0, 300]);
    expect(r.totalSec).toBe(600);
    expect(r.gaps).toHaveLength(1);
    expect(r.gaps[0].reasons.join()).toMatch(/key|BPM/);
    expect(r.warnings.some((w) => w.kind === 'artist')).toBe(true);
  });

  it('foreslår ideell brolåt og finner kandidater', () => {
    const a = tr({ camelot: '8A', bpm: 124, energy: 5 });
    const b = tr({ camelot: '10A', bpm: 130, energy: 7 });
    const ideal = idealBridge(a, b);
    expect(ideal.keys[0]).toBe('9A');
    expect(ideal.bpm).toBe(127);
    expect(ideal.energy).toBe(6);
    expect(ideal.description).toMatch(/^needs: 9A/);
    const good = tr({ camelot: '9A', bpm: 127, energy: 6 });
    const bad = tr({ camelot: '3B', bpm: 100, energy: 1 });
    const res = findBridges(a, b, [bad, good]);
    expect(res[0].track.id).toBe(good.id);
    expect(res.find((x) => x.track.id === bad.id)).toBeUndefined();
  });
});

describe('bytte ut en låt', () => {
  const mk = (id: string, bpm: number | null, camelot: string | null, energy: number | null = null) => ({ id, artist: id, title: id, bpm, camelot, energy, durationSec: 360 });
  const prev = mk('prev', 134, '8A', 6);
  const next = mk('next', 136, '9A', 7);
  const good = mk('good', 135, '8A', 7); // 8A → 8A → 9A
  const better = mk('better', 135, '9A', 6); // 8A → 9A → 9A
  const clash = mk('clash', 135, '3B', 6);
  const slow = mk('slow', 118, '8A', 6);

  it('rangerer etter begge overgangene og hopper over det som ikke passer', () => {
    const r = findReplacements(prev, next, [clash, good, slow, better, prev, next]);
    expect(r.map((x) => x.track.id)).toEqual(expect.arrayContaining(['good', 'better']));
    expect(r.map((x) => x.track.id)).not.toContain('clash');
    expect(r.map((x) => x.track.id)).not.toContain('slow');
    expect(r.map((x) => x.track.id)).not.toContain('prev');
    expect(r[0].into).not.toBeNull();
    expect(r[0].score).toBe(Math.min(r[0].into!, r[0].out!));
  });

  it('først eller sist i settet: bare én nabo teller', () => {
    const first = findReplacements(null, next, [good, clash]);
    expect(first[0]).toMatchObject({ into: null });
    expect(first[0].score).toBe(first[0].out);
    const last = findReplacements(prev, null, [good]);
    expect(last[0]).toMatchObject({ out: null });
  });

  it('energien teller når kurven gir et mål', () => {
    const lowE = mk('lowE', 135, '8A', 2);
    const highE = mk('highE', 135, '8A', 8);
    const r = findReplacements(prev, next, [lowE, highE], { targetEnergy: 8 });
    expect(r[0].track.id).toBe('highE');
    expect(r[0].energyFit).toBe(100);
  });

  it('beskriver hva som trengs på plassen', () => {
    expect(idealReplacement(prev, next, 7.4).description).toMatch(/~135 BPM, energy 7$/);
    expect(idealReplacement(null, next, null).description).toMatch(/9A/);
    expect(idealReplacement(null, null, null).description).toBe('not enough data to suggest');
  });
});

describe('key fra Spotify (Exportify)', () => {
  it('gjør om Spotify sin key/mode riktig til Camelot', async () => {
    const { spotifyKeyToCamelot } = await import('../../importers/csvImport');
    // key = toneklasse (C = 0), mode 1 = dur, 0 = moll
    expect(spotifyKeyToCamelot('9', '0')).toBe('8A'); // A-moll
    expect(spotifyKeyToCamelot('0', '1')).toBe('8B'); // C-dur
    expect(spotifyKeyToCamelot('6', '0')).toBe('11A'); // F#-moll
    expect(spotifyKeyToCamelot('8', '0')).toBe('1A'); // G#/Ab-moll
    expect(spotifyKeyToCamelot('11', '1')).toBe('1B'); // B-dur
    expect(spotifyKeyToCamelot('1', '1')).toBe('3B'); // Db-dur
    expect(spotifyKeyToCamelot('-1', '1')).toBeNull(); // Spotify fant ingen key
  });

  it('foreslår de vanligste forvekslingene', async () => {
    const { likelyMisreads } = await import('../camelot');
    expect(likelyMisreads('8A')).toEqual(['8B', '7A', '9A']);
    expect(likelyMisreads('1B')).toEqual(['1A', '12B', '2B']);
    expect(likelyMisreads('12A')).toEqual(['12B', '11A', '1A']);
    expect(likelyMisreads(null)).toEqual([]);
  });
});
