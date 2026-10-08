import { useEffect, useState } from 'react';

/** Kategorier man kan bla i (Browse) */
export type CategoryKind = 'key' | 'genre' | 'bpm' | 'energy' | 'tag' | 'mood' | 'decade' | 'status' | 'attention';

export type Route =
  | { name: 'home' }
  | { name: 'library' }
  | { name: 'browse' }
  | { name: 'category'; kind: CategoryKind; value: string }
  | { name: 'sets' }
  | { name: 'set'; id: string }
  | { name: 'settings' };

const KINDS: CategoryKind[] = ['key', 'genre', 'bpm', 'energy', 'tag', 'mood', 'decade', 'status', 'attention'];

/** Hash-ruting (#/library, #/browse/key/8A …) — virker på statisk hosting og med tilbakeknappen. */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case undefined:
    case '':
      return { name: 'home' };
    case 'library':
      return { name: 'library' };
    case 'browse':
      if (parts[1] && KINDS.includes(parts[1] as CategoryKind) && parts[2]) return { name: 'category', kind: parts[1] as CategoryKind, value: parts[2] };
      return { name: 'browse' };
    case 'sets':
      return parts[1] ? { name: 'set', id: parts[1] } : { name: 'sets' };
    case 'settings':
      return { name: 'settings' };
    default:
      return { name: 'home' };
  }
}

export function href(r: Route): string {
  const e = encodeURIComponent;
  switch (r.name) {
    case 'home':
      return '#/';
    case 'library':
      return '#/library';
    case 'browse':
      return '#/browse';
    case 'category':
      return `#/browse/${r.kind}/${e(r.value)}`;
    case 'sets':
      return '#/sets';
    case 'set':
      return `#/sets/${e(r.id)}`;
    case 'settings':
      return '#/settings';
  }
}

export function navigate(r: Route) {
  window.location.hash = href(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const keyRoute = (camelot: string): Route => ({ name: 'category', kind: 'key', value: camelot });
