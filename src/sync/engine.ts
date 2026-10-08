import Dexie from 'dexie';
import { tombstoneKey, type DjDatabase, type SyncKind } from '../db/db';
import type { DjSet, Track } from '../db/types';

/**
 * Lokal-først synkronisering.
 *
 * Alt lagres først i IndexedDB (virker uten nett). En synkrunde
 *   1. henter rader fra skyen som er endret siden sist (pull), og
 *   2. sender lokale endringer og slettinger opp (push).
 * Konflikter løses med «siste endring vinner» basert på updatedAt.
 * Serveren nekter dessuten å overskrive en nyere versjon med en eldre.
 */

export interface RemoteRow {
  kind: SyncKind;
  id: string;
  data: Track | DjSet | null;
  deleted: boolean;
  client_updated_at: string;
  /** Serverens tidsstempel, brukes som markør for neste henting */
  updated_at: string;
}

export type OutRow = Omit<RemoteRow, 'updated_at'>;

export interface Remote {
  /** Rader endret etter `since` (eller alt når since er null), sortert etter updated_at */
  pull(since: string | null): Promise<RemoteRow[]>;
  push(rows: OutRow[]): Promise<void>;
}

export interface SyncCursor {
  lastPulledAt: string | null;
  lastPushedAt: string | null;
}

export interface SyncResult {
  cursor: SyncCursor;
  pulled: number;
  applied: number;
  pushed: number;
}

/** Overlapp ved henting, så rader som ble skrevet samtidig ikke går tapt */
export const PULL_OVERLAP_MS = 2 * 60 * 1000;

export const SYNC_TX_FLAG = '__fromSync';
function markSyncTransaction() {
  const tx = Dexie.currentTransaction as unknown as Record<string, unknown> | null;
  if (tx) tx[SYNC_TX_FLAG] = true;
}
export const isSyncTransaction = (tx: unknown) => !!(tx && (tx as Record<string, unknown>)[SYNC_TX_FLAG]);

const table = (db: DjDatabase, kind: SyncKind) => (kind === 'track' ? db.tracks : db.sets);
const ms = (iso: string) => new Date(iso).getTime();

export async function syncOnce(db: DjDatabase, remote: Remote, cursor: SyncCursor, now: () => Date = () => new Date()): Promise<SyncResult> {
  // Alt med updatedAt etter dette tidspunktet tas med i neste runde
  const pushStartedAt = now().toISOString();

  /* ---------- 1. Hent ---------- */
  const since = cursor.lastPulledAt ? new Date(ms(cursor.lastPulledAt) - PULL_OVERLAP_MS).toISOString() : null;
  const rows = await remote.pull(since);
  let applied = 0;
  let lastPulledAt = cursor.lastPulledAt;
  // Det vi akkurat hentet skal ikke sendes tilbake uendret
  const justPulled = new Map<string, string>();

  await db.transaction('rw', db.tracks, db.sets, db.tombstones, async () => {
    // Merk transaksjonen, så endrings-hooks vet at dette kommer fra skyen (og ikke starter en ny synk)
    markSyncTransaction();
    for (const r of rows) {
      if (!lastPulledAt || r.updated_at > lastPulledAt) lastPulledAt = r.updated_at;
      const t = table(db, r.kind);
      const key = tombstoneKey(r.kind, r.id);
      const local = (await t.get(r.id)) as Track | DjSet | undefined;
      const tomb = await db.tombstones.get(key);
      if (r.deleted) {
        if (local && ms(local.updatedAt) <= ms(r.client_updated_at)) {
          await t.delete(r.id);
          applied++;
        }
        if (!tomb || ms(tomb.deletedAt) < ms(r.client_updated_at)) await db.tombstones.put({ key, kind: r.kind, id: r.id, deletedAt: r.client_updated_at });
        justPulled.set(key, r.client_updated_at);
        continue;
      }
      if (!r.data) continue;
      // Slettet her etter at den andre enheten endret den → slettingen vinner
      if (tomb && ms(tomb.deletedAt) >= ms(r.client_updated_at)) continue;
      if (!local || ms(local.updatedAt) < ms(r.client_updated_at)) {
        await (t as typeof db.tracks).put(r.data as Track);
        if (tomb) await db.tombstones.delete(key);
        applied++;
      }
      justPulled.set(key, r.client_updated_at);
    }
  });

  /* ---------- 2. Send ---------- */
  const after = cursor.lastPushedAt;
  const changed = <T extends { id: string; updatedAt: string }>(xs: T[]) => xs.filter((x) => !after || x.updatedAt > after);
  const [tracks, sets, tombs] = await Promise.all([
    after ? db.tracks.where('updatedAt').above(after).toArray() : db.tracks.toArray(),
    after ? db.sets.where('updatedAt').above(after).toArray() : db.sets.toArray(),
    after ? db.tombstones.where('deletedAt').above(after).toArray() : db.tombstones.toArray(),
  ]);
  const out: OutRow[] = [];
  const unchangedSincePull = (kind: SyncKind, id: string, at: string) => justPulled.get(tombstoneKey(kind, id)) === at;
  for (const t of changed(tracks)) if (!unchangedSincePull('track', t.id, t.updatedAt)) out.push({ kind: 'track', id: t.id, data: t, deleted: false, client_updated_at: t.updatedAt });
  for (const s of changed(sets)) if (!unchangedSincePull('set', s.id, s.updatedAt)) out.push({ kind: 'set', id: s.id, data: s, deleted: false, client_updated_at: s.updatedAt });
  for (const x of tombs) if (!unchangedSincePull(x.kind, x.id, x.deletedAt)) out.push({ kind: x.kind, id: x.id, data: null, deleted: true, client_updated_at: x.deletedAt });

  for (let i = 0; i < out.length; i += 500) await remote.push(out.slice(i, i + 500));

  return { cursor: { lastPulledAt, lastPushedAt: pushStartedAt }, pulled: rows.length, applied, pushed: out.length };
}
