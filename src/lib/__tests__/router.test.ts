import { href, parseHash, type Route } from '../router';

it('ruter frem og tilbake', () => {
  const routes: Route[] = [
    { name: 'home' },
    { name: 'library' },
    { name: 'browse' },
    { name: 'category', kind: 'key', value: '8A' },
    { name: 'category', kind: 'genre', value: 'Drum & Bass' },
    { name: 'category', kind: 'bpm', value: '120-125' },
    { name: 'sets' },
    { name: 'set', id: 'abc-123' },
    { name: 'settings' },
  ];
  for (const r of routes) expect(parseHash(href(r))).toEqual(r);
  expect(parseHash('')).toEqual({ name: 'home' });
  expect(parseHash('#/browse/nonsense/x')).toEqual({ name: 'browse' });
});
