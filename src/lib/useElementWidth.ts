import { useEffect, useRef, useState } from 'react';

/** Bredden til et element, oppdatert ved endring (for SVG-grafer i piksler). */
export function useElementWidth<T extends HTMLElement>(fallback = 300) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    const ro = new ResizeObserver((entries) => setWidth(Math.round(entries[0].contentRect.width) || fallback));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}
