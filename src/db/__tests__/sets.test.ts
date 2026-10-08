import { DjDatabase } from '../db';
import { addTrack } from '../tracks';
import { createSet, duplicateSet, markSetPlayed, playSecFor, saveSet } from '../sets';

it('dupliserer og markerer sett som spilt', async () => {
  const db = new DjDatabase(`s-${Math.random()}`);
  const t = await addTrack({ artist: 'A', title: 'B', durationSec: 400 }, db);
  const s = await createSet('Lørdag', db);
  await saveSet({ ...s, slots: [{ trackId: t.id, locked: false }], poolIds: [t.id] }, db);
  const copy = await duplicateSet(s.id, db);
  expect(copy!.name).toBe('Lørdag (copy)');
  expect(copy!.slots).toHaveLength(1);
  await markSetPlayed(s.id, new Date('2026-10-10T22:00:00Z'), db);
  const after = await db.tracks.get(t.id);
  expect(after!.playCount).toBe(1);
  expect(after!.lastPlayedAt).toBe('2026-10-10T22:00:00.000Z');
  await db.delete();
});

it('spilletid per låt', () => {
  expect(playSecFor({ playMode: 'full', fixedMinutes: 3 })({ durationSec: 400 })).toBe(355);
  expect(playSecFor({ playMode: 'fixed', fixedMinutes: 3 })({ durationSec: 400 })).toBe(180);
});
