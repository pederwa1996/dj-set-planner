import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Compass, Home as HomeIcon, Keyboard, Library, ListMusic, Menu, Plus, Settings, Upload, X } from 'lucide-react';
import { db, requestPersistentStorage } from './db/db';
import { createSet } from './db/sets';
import { makeDupKey } from './lib/normalize';
import { href, navigate, useRoute, type Route } from './lib/router';
import { closeHelp, closeImport, closeTrack, openHelp, openImport, openTrack, useUi, anyDialogOpen } from './lib/uiStore';
import { useHotkeys } from './lib/useHotkeys';
import { cancelBulkLookup, dismissBulkLookup, useBulkLookup } from './sources/bulkStore';
import { Button, Modal } from './components/ui';
import { Logo } from './components/Logo';
import { HomeView } from './features/home/HomeView';
import { LibraryView } from './features/library/LibraryView';
import { BrowseView } from './features/browse/BrowseView';
import { CategoryView } from './features/browse/CategoryView';
import { SetsView } from './features/sets/SetsView';
import { SetEditor } from './features/sets/SetEditor';
import { SettingsView } from './features/settings/SettingsView';
import { ImportDialog } from './features/import/ImportDialog';
import { TrackEditor } from './features/library/TrackEditor';
import { collectValues } from './features/library/filter';

export default function App() {
  const route = useRoute();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    requestPersistentStorage();
  }, []);
  useEffect(() => setDrawer(false), [route]);

  useHotkeys(
    useMemo(
      () => ({
        '?': () => openHelp(),
        n: () => !anyDialogOpen() && openTrack(null),
        i: () => !anyDialogOpen() && openImport(),
      }),
      [],
    ),
  );

  return (
    <div className="min-h-dvh lg:pl-[264px]">
      {/* Sidemeny (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-line/60 bg-sidebar lg:flex">
        <Sidebar route={route} />
      </aside>

      {/* Toppstripe (mobil) */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line/60 bg-sidebar/95 px-2 py-2 backdrop-blur lg:hidden">
        <button type="button" className="grid h-11 w-11 place-items-center rounded-xl text-ink2 hover:bg-raised" onClick={() => setDrawer(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <a href="#/" className="flex items-center gap-2">
          <Logo size={22} />
          <span className="serif text-lg">Set Planner</span>
        </a>
        <button type="button" className="ml-auto grid h-11 w-11 place-items-center rounded-xl text-ink2 hover:bg-raised" onClick={() => openImport()} aria-label="Import tracks">
          <Upload size={19} />
        </button>
      </header>

      {/* Skuff (mobil) */}
      {drawer && (
        <div className="fixed inset-0 z-50 animate-fade-in bg-black/60 lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setDrawer(false)}>
          <aside className="flex h-full w-[86%] max-w-[300px] animate-slide-in bg-sidebar shadow-2xl">
            <Sidebar route={route} onClose={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <BulkProgressBar />
      <main className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-5 sm:px-8 sm:pt-8">
        <RouteView route={route} />
      </main>

      <GlobalDialogs />
    </div>
  );
}

function RouteView({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <HomeView />;
    case 'library':
      return <LibraryView />;
    case 'browse':
      return <BrowseView />;
    case 'category':
      return <CategoryView kind={route.kind} value={route.value} />;
    case 'sets':
      return <SetsView />;
    case 'set':
      return <SetEditor setId={route.id} />;
    case 'settings':
      return <SettingsView />;
  }
}

function NavItem({ to, active, icon, children }: { to: Route; active: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <a
      href={href(to)}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm transition ${active ? 'bg-raised text-ink' : 'text-ink2 hover:bg-raised/60 hover:text-ink'}`}
    >
      <span className={active ? 'text-accent' : 'text-muted'}>{icon}</span>
      {children}
    </a>
  );
}

function Sidebar({ route, onClose }: { route: Route; onClose?: () => void }) {
  const sets = useLiveQuery(() => db.sets.orderBy('updatedAt').reverse().limit(8).toArray(), []);
  const is = (...names: Route['name'][]) => names.includes(route.name);

  return (
    <div className="flex h-full w-full flex-col gap-1 px-3 py-3">
      <div className="flex items-center gap-2 px-2 pb-3 pt-1">
        <a href="#/" className="flex items-center gap-2.5">
          <Logo size={24} />
          <span className="serif text-[19px]">Set Planner</span>
        </a>
        {onClose && (
          <button type="button" className="ml-auto grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-raised" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={async () => {
          const s = await createSet(`New set · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`);
          navigate({ name: 'set', id: s.id });
        }}
        className="mb-2 flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-ink transition hover:bg-raised/60"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-[#1f1e1d]">
          <Plus size={15} strokeWidth={2.5} />
        </span>
        New set
      </button>

      <NavItem to={{ name: 'home' }} active={is('home')} icon={<HomeIcon size={18} />}>
        Home
      </NavItem>
      <NavItem to={{ name: 'library' }} active={is('library')} icon={<Library size={18} />}>
        Library
      </NavItem>
      <NavItem to={{ name: 'browse' }} active={is('browse', 'category')} icon={<Compass size={18} />}>
        Browse
      </NavItem>
      <NavItem to={{ name: 'sets' }} active={is('sets')} icon={<ListMusic size={18} />}>
        Sets
      </NavItem>

      {sets && sets.length > 0 && (
        <div className="mt-5 flex min-h-0 flex-1 flex-col">
          <div className="px-3 pb-1.5 text-xs font-medium text-muted">Recent sets</div>
          <nav className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
            {sets.map((s) => (
              <a
                key={s.id}
                href={href({ name: 'set', id: s.id })}
                className={`truncate rounded-lg px-3 py-2 text-[13px] transition ${route.name === 'set' && route.id === s.id ? 'bg-raised text-ink' : 'text-ink2 hover:bg-raised/60 hover:text-ink'}`}
              >
                {s.name}
              </a>
            ))}
          </nav>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-1 border-t border-line/60 pt-2">
        <button type="button" onClick={() => openImport()} className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-ink2 hover:bg-raised/60 hover:text-ink">
          <Upload size={18} className="text-muted" /> Import tracks
        </button>
        <NavItem to={{ name: 'settings' }} active={is('settings')} icon={<Settings size={18} />}>
          Settings
        </NavItem>
        <button type="button" onClick={() => openHelp()} className="hidden min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-ink2 hover:bg-raised/60 hover:text-ink lg:flex">
          <Keyboard size={18} className="text-muted" /> Shortcuts
        </button>
      </div>
    </div>
  );
}

function GlobalDialogs() {
  const ui = useUi();
  const tracks = useLiveQuery(() => db.tracks.toArray(), []);
  const all = tracks ?? [];
  const values = useMemo(() => collectValues(all), [all]);
  const byDupKey = useMemo(() => {
    const m = new Map<string, typeof all>();
    for (const t of all) m.set(t.dupKey, [...(m.get(t.dupKey) ?? []), t]);
    return m;
  }, [all]);

  return (
    <>
      <ImportDialog open={ui.importOpen} onClose={closeImport} existing={all} genres={values.genres} tags={values.tags} />
      <TrackEditor open={ui.editing !== undefined} track={ui.editing ?? null} onClose={closeTrack} suggestions={values} duplicateOf={(a, t, v) => byDupKey.get(makeDupKey(a, t, v)) ?? []} />
      <Modal open={ui.helpOpen} onClose={closeHelp} title="Keyboard shortcuts">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          {[
            ['N', 'New track'],
            ['I', 'Import tracks'],
            ['/', 'Search the library'],
            ['F', 'Show / hide filters (library)'],
            ['A', 'Set: add tracks'],
            ['B', 'Set: build order'],
            ['E', 'Set: export'],
            ['Ctrl+Z / Ctrl+Shift+Z', 'Set: undo / redo'],
            ['Ctrl+Enter', 'Save track'],
            ['Esc', 'Close dialog / clear selection'],
            ['?', 'This overview'],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt>
                <kbd className="rounded-md border border-line bg-sidebar px-2 py-1 font-mono text-xs">{k}</kbd>
              </dt>
              <dd className="self-center text-ink2">{v}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </>
  );
}

function BulkProgressBar() {
  const { running, progress: p } = useBulkLookup();
  if (!p) return null;
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  return (
    <div className="sticky top-[61px] z-20 border-b border-line/60 bg-sidebar/95 backdrop-blur lg:top-0">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[13px] sm:px-8">
        <span className="font-medium text-ink">{running ? `Looking up online… ${p.done}/${p.total}` : `Done — ${p.done} of ${p.total} looked up`}</span>
        <span className="text-ink2">✓ {p.ok} filled in</span>
        {p.uncertain > 0 && <span className="text-ok">? {p.uncertain} to check</span>}
        {p.notfound > 0 && <span className="text-muted">✕ {p.notfound} not found</span>}
        {p.errors > 0 && <span className="text-bad">! {p.errors} errors</span>}
        {running && p.current && <span className="hidden truncate text-muted md:inline">{p.current}</span>}
        <span className="ml-auto">
          <Button size="sm" variant="ghost" onClick={running ? cancelBulkLookup : dismissBulkLookup}>
            {running ? 'Stop' : 'Dismiss'}
          </Button>
        </span>
      </div>
      <div className="h-0.5 bg-line">
        <div className="h-0.5 bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
