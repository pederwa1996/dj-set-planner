import { useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import { db } from '../db/db';
import { usernameFromEmail } from './auth';
import { isSyncTransaction, syncOnce, type SyncCursor } from './engine';
import { supabaseRemote } from './remote';
import { supabase } from './supabase';

export type SyncStatus = 'checking' | 'signed-out' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  user: { id: string; username: string } | null;
  lastSyncedAt: string | null;
  error: string | null;
}

let state: SyncState = { status: 'checking', user: null, lastSyncedAt: null, error: null };
const listeners = new Set<() => void>();
const set = (s: Partial<SyncState>) => {
  state = { ...state, ...s };
  listeners.forEach((l) => l());
};

const cursorKey = (uid: string) => `sync.cursor.${uid}`;
function loadCursor(uid: string): SyncCursor {
  try {
    return JSON.parse(localStorage.getItem(cursorKey(uid)) ?? '') as SyncCursor;
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}
function saveCursor(uid: string, c: SyncCursor) {
  try {
    localStorage.setItem(cursorKey(uid), JSON.stringify(c));
    localStorage.setItem(`${cursorKey(uid)}.at`, new Date().toISOString());
  } catch {
    /* ignorer */
  }
}

let running = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export async function syncNow(): Promise<void> {
  const user = state.user;
  if (!user) return;
  if (!navigator.onLine) {
    set({ status: 'offline' });
    return;
  }
  if (running) {
    again = true;
    return;
  }
  running = true;
  set({ status: 'syncing', error: null });
  try {
    const result = await syncOnce(db, supabaseRemote(supabase(), user.id), loadCursor(user.id));
    saveCursor(user.id, result.cursor);
    set({ status: 'idle', lastSyncedAt: new Date().toISOString(), error: null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    set({ status: navigator.onLine ? 'error' : 'offline', error: msg });
  } finally {
    running = false;
    if (again) {
      again = false;
      schedule(500);
    }
  }
}

/** Synk litt etter en endring (samler flere raske endringer i én runde) */
export function schedule(ms = 1500) {
  if (!state.user) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, ms);
}

function applySession(session: Session | null) {
  const prev = state.user?.id;
  if (session?.user) {
    const user = { id: session.user.id, username: (session.user.user_metadata?.username as string) || usernameFromEmail(session.user.email) };
    let lastSyncedAt: string | null = null;
    try {
      lastSyncedAt = localStorage.getItem(`${cursorKey(user.id)}.at`);
    } catch {
      /* ignorer */
    }
    set({ user, status: navigator.onLine ? 'idle' : 'offline', lastSyncedAt });
    if (prev !== user.id) schedule(100);
  } else {
    set({ user: null, status: 'signed-out', error: null });
  }
}

let started = false;
/** Kalles én gang når appen starter */
export function startSync() {
  if (started) return;
  started = true;

  supabase()
    .auth.getSession()
    .then(({ data }) => applySession(data.session))
    .catch(() => set({ status: 'signed-out' }));
  supabase().auth.onAuthStateChange((_event, session) => applySession(session));

  // Lokale endringer → synk (men ikke endringer som selv kom fra skyen)
  const onChange = function (this: unknown, ...args: unknown[]) {
    const tx = args[args.length - 1];
    if (!isSyncTransaction(tx)) schedule();
  };
  for (const t of [db.tracks, db.sets, db.tombstones]) {
    t.hook('creating', (_pk, _obj, tx) => onChange(tx));
    t.hook('updating', (_mods, _pk, _obj, tx) => {
      onChange(tx);
      return undefined;
    });
    t.hook('deleting', (_pk, _obj, tx) => onChange(tx));
  }

  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => state.user && set({ status: 'offline' }));
  window.addEventListener('focus', () => schedule(200));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && schedule(200));
  setInterval(() => document.visibilityState === 'visible' && state.user && void syncNow(), 30_000);
}

export function useSync(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
