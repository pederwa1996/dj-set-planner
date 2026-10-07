import { useSyncExternalStore } from 'react';
import { runBulkLookup, type BulkProgress } from './bulk';

/** Global tilstand for masseoppslag, så fremdriften vises selv om dialogen lukkes. */
interface State {
  running: boolean;
  progress: BulkProgress | null;
}

let state: State = { running: false, progress: null };
let ctrl: AbortController | null = null;
const listeners = new Set<() => void>();
const set = (s: Partial<State>) => {
  state = { ...state, ...s };
  listeners.forEach((l) => l());
};

export function startBulkLookup(ids: string[]) {
  if (state.running || !ids.length) return;
  ctrl = new AbortController();
  set({ running: true, progress: { done: 0, total: ids.length, ok: 0, uncertain: 0, notfound: 0, errors: 0, current: '' } });
  runBulkLookup(ids, (p) => set({ progress: p }), ctrl.signal)
    .then((p) => set({ running: false, progress: p }))
    .catch(() => set({ running: false }));
}

export function cancelBulkLookup() {
  ctrl?.abort();
  set({ running: false });
}

export function dismissBulkLookup() {
  if (!state.running) set({ progress: null });
}

export function useBulkLookup(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
