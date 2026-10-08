import { vi } from 'vitest';
import { DjDatabase } from '../../../db/db';
import { createSet } from '../../../db/sets';
import { buildSequences } from '../../../engine/sequencer';
import { presetCurve } from '../../../engine/energy';
import { playSecFor } from '../../../db/sets';
import { describeLength, estimateLength, formatLength, getLengthDefaults, saveLengthDefaults } from '../setLength';

const full = { targetMinutes: 60, playMode: 'full' as const, fixedMinutes: 3.5 };

it('formaterer lengder', () => {
  expect(formatLength(52 * 60)).toBe('52 min');
  expect(formatLength(3600)).toBe('1 h');
  expect(formatLength(4 * 3600 + 12 * 60)).toBe('4 h 12 min');
});

it('anslår hvor mange låter som får plass', () => {
  // 40 låter à 7:00 → 6:15 spilletid hver → 60 min ≈ 10 låter
  const e = estimateLength(Array(40).fill(420), full);
  expect(e.totalSec).toBe(40 * 375);
  expect(e.fits).toBe(10);
  expect(describeLength(e, full)).toMatch(/A 60 min set uses about 10 of them/);
  // Fast spilletid 3 min → 20 låter
  expect(estimateLength(Array(40).fill(420), { ...full, playMode: 'fixed', fixedMinutes: 3 }).fits).toBe(20);
  // Ingen grense → alle
  const all = estimateLength(Array(40).fill(420), { ...full, targetMinutes: null });
  expect(all.fits).toBeNull();
  expect(describeLength(all, { ...full, targetMinutes: null })).toMatch(/^All 40 tracks go in: about 4 h 10 min\.$/);
  // Få låter: alle får plass, men fyller ikke
  expect(describeLength(estimateLength([420, 420], full), full)).toMatch(/All 2 tracks fit .* add more to fill 60 min/);
  // Spillelisterekkefølge: alle med, og hvor mye over
  expect(describeLength(estimateLength(Array(20).fill(420), full), full, { keepAll: true })).toBe('All 20 tracks go in: about 2 h 5 min — 1 h 5 min over.');
  // Uten pott: typisk låt
  expect(describeLength(estimateLength([], full), full)).toBe('A 60 min set is about 13 tracks (whole tracks, about 5 min each).');
});

it('anslaget stemmer med det motoren faktisk velger', () => {
  const pool = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, artist: `A${i}`, title: `T${i}`, bpm: 130 + (i % 5), camelot: `${(i % 12) + 1}A`, energy: 5 + (i % 4), durationSec: 420 }));
  const e = estimateLength(pool.map((t) => t.durationSec), full);
  const [best] = buildSequences(pool, { curve: presetCurve('warmup-peak-close'), targetSec: 3600, playSec: playSecFor(full) });
  expect(Math.abs(best.order.length - e.fits!)).toBeLessThanOrEqual(1);
  // Uten grense brukes alle
  const [every] = buildSequences(pool, { curve: presetCurve('warmup-peak-close'), targetSec: null, playSec: playSecFor(full) });
  expect(every.order).toHaveLength(30);
});

it('husker siste valg og lager settet med riktig lengde', async () => {
  const mem = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) });
  saveLengthDefaults({ targetMinutes: 90, playMode: 'fixed', fixedMinutes: 3 });
  expect(getLengthDefaults()).toEqual({ targetMinutes: 90, playMode: 'fixed', fixedMinutes: 3 });
  const db = new DjDatabase(`len-${Math.random()}`);
  const s = await createSet('Saturday', { ...getLengthDefaults(), date: '2026-10-10' }, db);
  const stored = await db.sets.get(s.id);
  expect(stored).toMatchObject({ name: 'Saturday', targetMinutes: 90, playMode: 'fixed', fixedMinutes: 3, date: '2026-10-10' });
  await db.delete();
  vi.unstubAllGlobals();
});
