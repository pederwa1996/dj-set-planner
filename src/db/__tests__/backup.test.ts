import { DjDatabase } from '../db';
import { addTrack } from '../tracks';
import { createSet } from '../sets';
import { createBackup, restoreBackup } from '../backup';

it('backup og gjenoppretting gir samme data', async () => {
  const a = new DjDatabase(`a-${Math.random()}`);
  const b = new DjDatabase(`b-${Math.random()}`);
  await addTrack({ artist: 'X', title: 'Y', bpm: 128, camelot: '8A', tags: ['vokal'] }, a);
  await addTrack({ artist: 'Z', title: 'W', status: 'wishlist' }, b);
  await createSet('Lørdag', a);
  const backup = JSON.parse(JSON.stringify(await createBackup(a)));

  expect(await restoreBackup(backup, 'merge', b)).toBe(1);
  expect(await b.tracks.count()).toBe(2);
  await restoreBackup(backup, 'replace', b);
  const strip = <T extends { updatedAt: string }>(xs: T[]) => xs.map(({ updatedAt: _u, ...rest }) => rest);
  expect(strip(await b.tracks.toArray())).toEqual(strip(await a.tracks.toArray()));
  // erstatt: låten som bare fantes på b, får en tombstone så slettingen synkroniseres
  expect((await b.tombstones.toArray()).map((t) => t.kind)).toEqual(['track']);
  expect((await b.sets.toArray()).map((s) => s.name)).toEqual(['Lørdag']);
  await expect(restoreBackup({ foo: 1 }, 'merge', b)).rejects.toThrow(/valid/);
  await a.delete();
  await b.delete();
});
