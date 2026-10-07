import { DjDatabase } from '../db';
import { addTrack, updateTrack } from '../tracks';

let db: DjDatabase;
beforeEach(async () => {
  db = new DjDatabase(`test-${Math.random()}`);
  await db.open();
});
afterEach(() => db.delete());

describe('låt-lagring', () => {
  it('lagrer, normaliserer key og rydder felter', async () => {
    const t = await addTrack(
      { artist: ' Paul van Dyk ', title: 'For An Angel', camelot: 'A minor', bpm: 138.456, energy: 14, tags: ['Klassiker', 'klassiker', ' '] },
      db,
    );
    const saved = await db.tracks.get(t.id);
    expect(saved).toMatchObject({ artist: 'Paul van Dyk', camelot: '8A', bpm: 138.46, energy: 10, tags: ['klassiker'], status: 'owned' });
  });

  it('oppdaterer dupKey når tittel endres', async () => {
    const t = await addTrack({ artist: 'A', title: 'One' }, db);
    await updateTrack(t.id, { title: 'Two' }, db);
    expect((await db.tracks.get(t.id))!.dupKey).toBe('a|two|');
  });
});
