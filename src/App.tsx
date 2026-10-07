import { useEffect, useMemo, useState } from 'react';
import { LibraryView } from './features/library/LibraryView';
import { SettingsDialog } from './features/settings/SettingsDialog';
import { SetsView } from './features/sets/SetsView';
import { useLocalStorage } from './lib/useLocalStorage';
import { Button, Modal } from './components/ui';
import { requestPersistentStorage } from './db/db';
import { useHotkeys } from './lib/useHotkeys';
import { cancelBulkLookup, dismissBulkLookup, useBulkLookup } from './sources/bulkStore';

type Tab = 'library' | 'sets' | 'profiles' | 'recs';
const TABS: { id: Tab; label: string; soon?: boolean }[] = [
  { id: 'library', label: 'Bibliotek' },
  { id: 'sets', label: 'Sets' },
  { id: 'profiles', label: 'Sjangerprofiler', soon: true },
  { id: 'recs', label: 'Anbefalinger', soon: true },
];

export default function App() {
  const [tab, setTab] = useLocalStorage<Tab>('app.tab', 'library');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    requestPersistentStorage();
  }, []);

  useHotkeys(useMemo(() => ({ '?': () => setHelpOpen(true) }), []));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-3 py-2 sm:px-6">
          <span className="mr-2 whitespace-nowrap text-lg font-bold tracking-tight">
            <span className="text-accent">◉</span> <span className="hidden sm:inline">DJ Set Planner</span>
          </span>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={t.soon}
                onClick={() => setTab(t.id)}
                title={t.soon ? 'Kommer snart' : undefined}
                className={`min-h-11 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition ${tab === t.id ? 'bg-panel2 text-accent' : 'text-slate-300 hover:bg-panel2'} disabled:cursor-not-allowed disabled:opacity-35`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <Button variant="ghost" onClick={() => setHelpOpen(true)} aria-label="Hurtigtaster" className="hidden sm:inline-flex">
            ?
          </Button>
          <Button variant="ghost" onClick={() => setSettingsOpen(true)} aria-label="Innstillinger">
            ⚙<span className="hidden sm:inline"> Innstillinger</span>
          </Button>
        </div>
        <BulkProgressBar />
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-4 sm:px-6">
        {tab === 'library' && <LibraryView onOpenSettings={() => setSettingsOpen(true)} />}
        {tab === 'sets' && <SetsView />}
      </main>

      <footer className="px-3 py-4 text-center text-xs text-muted sm:px-6">
        BPM- og key-data fra{' '}
        <a className="underline hover:text-slate-300" href="https://getsongbpm.com" target="_blank" rel="noreferrer">
          GetSongBPM.com
        </a>{' '}
        · metadata fra Deezer og MusicBrainz · alt lagres lokalt i nettleseren din
      </footer>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Hurtigtaster">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          {[
            ['/', 'Søk i biblioteket'],
            ['N', 'Ny låt'],
            ['I', 'Importer liste/CSV'],
            ['F', 'Vis/skjul filtre'],
            ['Esc', 'Lukk dialog / fjern valg'],
            ['Ctrl+Enter', 'Lagre låt i skjemaet'],
            ['A', 'Set: legg til låter'],
            ['B', 'Set: bygg rekkefølge'],
            ['E', 'Set: eksport'],
            ['Ctrl+Z / Ctrl+Shift+Z', 'Set: angre / gjør om'],
            ['?', 'Denne oversikten'],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt>
                <kbd className="rounded border border-line bg-panel2 px-2 py-1 font-mono">{k}</kbd>
              </dt>
              <dd className="self-center text-slate-300">{v}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </div>
  );
}

function BulkProgressBar() {
  const { running, progress: p } = useBulkLookup();
  if (!p) return null;
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  return (
    <div className="border-t border-line bg-panel">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm sm:px-6">
        <span className="font-medium">{running ? `Henter data fra nett … ${p.done}/${p.total}` : `Ferdig: ${p.done}/${p.total} slått opp`}</span>
        <span className="text-good">✓ {p.ok} fylt inn</span>
        {p.uncertain > 0 && <span className="text-amber-300">? {p.uncertain} må sjekkes</span>}
        {p.notfound > 0 && <span className="text-muted">✗ {p.notfound} ikke funnet</span>}
        {p.errors > 0 && <span className="text-bad">⚠ {p.errors} feil</span>}
        {running && p.current && <span className="hidden truncate text-muted md:inline">{p.current}</span>}
        <span className="ml-auto">
          {running ? (
            <Button variant="ghost" className="!min-h-9" onClick={cancelBulkLookup}>
              Stopp
            </Button>
          ) : (
            <Button variant="ghost" className="!min-h-9" onClick={dismissBulkLookup}>
              Lukk
            </Button>
          )}
        </span>
      </div>
      <div className="h-1 bg-line">
        <div className="h-1 bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
