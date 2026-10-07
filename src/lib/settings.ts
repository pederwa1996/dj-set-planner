import { useEffect, useState } from 'react';

export interface AppSettings {
  /** Gratis nøkkel fra getsongbpm.com/api — lagres bare i denne nettleseren */
  getSongBpmKey: string;
  sources: { getsongbpm: boolean; deezer: boolean; musicbrainz: boolean };
}

const KEY = 'settings';
const DEFAULTS: AppSettings = {
  getSongBpmKey: '',
  sources: { getsongbpm: true, deezer: true, musicbrainz: true },
};

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw);
    return { ...DEFAULTS, ...p, sources: { ...DEFAULTS.sources, ...(p.sources ?? {}) } };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignorer */
  }
  window.dispatchEvent(new Event('settings-changed'));
}

export function useSettings(): [AppSettings, (s: AppSettings) => void] {
  const [s, setS] = useState(getSettings);
  useEffect(() => {
    const on = () => setS(getSettings());
    window.addEventListener('settings-changed', on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener('settings-changed', on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return [s, saveSettings];
}
