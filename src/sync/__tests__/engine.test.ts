import { DjDatabase } from '../../db/db';
import { addTrack, deleteTracks, updateTrack } from '../../db/tracks';
import { createSet, deleteSet } from '../../db/sets';
import { syncOnce, type OutRow, type Remote, type RemoteRow, type SyncCursor } from '../engine';

/** Falsk server med samme regler som Supabase-tabellen (nyere versjon vinner, servertid) */
class FakeRemote implements Remote {
  rows = new Map<string, RemoteRow>();
  pushes = 0;
  private clock = Date.parse('2026-10-08T12:00:00Z');
  private tick() {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }
  async pull(since: string | null) {
    return [...this.rows.values()].filter((r) => !since || r.updated_at > since).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  }
  async push(rows: OutRow[]) {
    this.pushes += rows.length;
    for (const r of rows) {
      const key = `${r.kind}:${r.id}`;
      const old = this.rows.get(key);
      if (old && r.client_updated_at < old.client_updated_at) continue;
      this.rows.set(key, { ...structuredClone(r), updated_at: this.tick() });
    }
  }
}

class Device {
  db = new DjDatabase(`dev-${Math.random()}`);
  cursor: SyncCursor = { lastPulledAt: null, lastPushedAt: null };
  constructor(private remote: FakeRemote) {}
  async sync() {
    const r = await syncOnce(this.db, this.remote, this.cursor);
    this.cursor = r.cursor;
    return r;
  }
}

const wait = (ms = 5) => new Promise((r) => setTimeout(r, ms));
let remote: FakeRemote;
let a: Device;
let b: Device;
beforeEach(() => {
  remote = new FakeRemote();
  a = new Device(remote);
  b = new Device(remote);
});
afterEach(async () => {
  await a.db.delete();
  await b.db.delete();
});

describe('synkronisering mellom to enheter', () => {
  it('låter og sets fra én enhet dukker opp på den andre', async () => {
    await addTrack({ artist: 'Chicane', title: 'Saltwater', bpm: 136, camelot: '6A' }, a.db);
    await createSet('Saturday', {}, a.db);
    expect((await a.sync()).pushed).toBe(2);
    const r = await b.sync();
    expect(r.applied).toBe(2);
    expect((await b.db.tracks.toArray())[0]).toMatchObject({ artist: 'Chicane', bpm: 136, camelot: '6A' });
    expect((await b.db.sets.toArray())[0].name).toBe('Saturday');
  });

  it('endringer går begge veier, og det som ble hentet sendes ikke tilbake', async () => {
    const t = await addTrack({ artist: 'A', title: 'One', bpm: 120 }, a.db);
    await a.sync();
    await b.sync();
    const pushesBefore = remote.pushes;
    expect((await b.sync()).pushed).toBe(0);
    await wait();
    await updateTrack(t.id, { bpm: 124 }, b.db);
    await b.sync();
    await a.sync();
    expect((await a.db.tracks.get(t.id))!.bpm).toBe(124);
    expect(remote.pushes - pushesBefore).toBe(1);
  });

  it('slettinger synkroniseres', async () => {
    const t = await addTrack({ artist: 'A', title: 'Gone' }, a.db);
    const s = await createSet('Old set', {}, a.db);
    await a.sync();
    await b.sync();
    expect(await b.db.tracks.count()).toBe(1);
    await wait();
    await deleteTracks([t.id], a.db);
    await deleteSet(s.id, a.db);
    await a.sync();
    await b.sync();
    expect(await b.db.tracks.count()).toBe(0);
    expect(await b.db.sets.count()).toBe(0);
  });

  it('siste endring vinner ved konflikt, på begge enheter', async () => {
    const t = await addTrack({ artist: 'A', title: 'Conflict', bpm: 120 }, a.db);
    await a.sync();
    await b.sync();
    await wait();
    await updateTrack(t.id, { bpm: 125 }, a.db); // eldst
    await wait();
    await updateTrack(t.id, { bpm: 130 }, b.db); // nyest
    await b.sync();
    await a.sync(); // a sender sin eldre versjon, men serveren beholder b sin
    await b.sync();
    expect((await a.db.tracks.get(t.id))!.bpm).toBe(130);
    expect((await b.db.tracks.get(t.id))!.bpm).toBe(130);
  });

  it('første innlogging på en enhet med egne data slår sammen begge bibliotekene', async () => {
    await addTrack({ artist: 'On A', title: 'x' }, a.db);
    await addTrack({ artist: 'On B', title: 'y' }, b.db);
    await a.sync();
    await b.sync();
    await a.sync();
    expect((await a.db.tracks.toArray()).map((t) => t.artist).sort()).toEqual(['On A', 'On B']);
    expect((await b.db.tracks.toArray()).map((t) => t.artist).sort()).toEqual(['On A', 'On B']);
  });

  it('en sletting som er nyere enn den andres endring vinner', async () => {
    const t = await addTrack({ artist: 'A', title: 'Edit vs delete' }, a.db);
    await a.sync();
    await b.sync();
    await wait();
    await updateTrack(t.id, { bpm: 128 }, b.db);
    await wait();
    await deleteTracks([t.id], a.db);
    await b.sync();
    await a.sync();
    await b.sync();
    expect(await a.db.tracks.count()).toBe(0);
    expect(await b.db.tracks.count()).toBe(0);
  });
});

describe('endrings-hooks', () => {
  it('skriving fra skyen er merket, lokale endringer er ikke det', async () => {
    const { isSyncTransaction } = await import('../engine');
    const seen: boolean[] = [];
    b.db.tracks.hook('creating', (_pk, _obj, tx) => {
      seen.push(isSyncTransaction(tx));
    });
    await addTrack({ artist: 'A', title: 'From A' }, a.db);
    await a.sync();
    await b.sync(); // kommer fra skyen
    await addTrack({ artist: 'B', title: 'Local on B' }, b.db); // lokal
    expect(seen).toEqual([true, false]);
  });
});
