import { useSyncExternalStore } from 'react';
import type { Track } from '../db/types';

/** Globale dialoger som kan åpnes fra hvor som helst (sidemeny, hjem, bibliotek …) */
interface UiState {
  importOpen: boolean;
  /** undefined = lukket, null = ny låt, Track = rediger */
  editing: Track | null | undefined;
  helpOpen: boolean;
  newSetOpen: boolean;
}

let state: UiState = { importOpen: false, editing: undefined, helpOpen: false, newSetOpen: false };
const listeners = new Set<() => void>();
const set = (s: Partial<UiState>) => {
  state = { ...state, ...s };
  listeners.forEach((l) => l());
};

export const openImport = () => set({ importOpen: true });
export const closeImport = () => set({ importOpen: false });
export const openTrack = (t: Track | null) => set({ editing: t });
export const closeTrack = () => set({ editing: undefined });
export const openHelp = () => set({ helpOpen: true });
export const closeHelp = () => set({ helpOpen: false });
export const openNewSet = () => set({ newSetOpen: true });
export const closeNewSet = () => set({ newSetOpen: false });

export function useUi(): UiState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** Er en dialog åpen? (brukes for å slå av hurtigtaster) */
export const anyDialogOpen = () => !!document.querySelector('[role=dialog]');
