import { useEffect, useState } from 'react';

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      const parsed = JSON.parse(raw);
      // For objekter: fyll inn nye felter som ikke fantes da verdien ble lagret
      if (initial && typeof initial === 'object' && !Array.isArray(initial)) return { ...initial, ...parsed };
      return parsed;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* full eller blokkert lagring */
    }
  }, [key, value]);
  return [value, setValue];
}
