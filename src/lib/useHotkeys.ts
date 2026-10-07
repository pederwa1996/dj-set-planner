import { useEffect } from 'react';

/** Enkle tastatursnarveier som ignoreres mens du skriver i et felt (unntatt Escape). */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
      if (typing && e.key !== 'Escape') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const fn = map[e.key];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [map, enabled]);
}
