import { useEffect, useMemo, useRef, useState } from 'react';
import { LibraryView } from './features/library/LibraryView';
import { Button, Modal } from './components/ui';
import { createBackup, downloadJson, restoreBackup } from './db/backup';
import { requestPersistentStorage } from './db/db';
import { useHotkeys } from './lib/useHotkeys';

type Tab = 'library' | 'sets' | 'profiles' | 'recs';
const TABS: { id: Tab; label: string; phase?: number }[] = [
  { id: 'library', label: 'Bibliotek' },
  { id: 'sets', label: 'Sets', phase: 3 },
  { id: 'profiles', label: 'Sjangerprofiler', phase: 5 },
  { id: 'recs', label: 'Anbefalinger', phase: 5 },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('library');
  const [dataOpen, setDataOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    requestPersistentStorage();
  }, []);

  useHotkeys(useMemo(() => ({ '?': () => setHelpOpen(true) }), []));

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-3 py-2 sm:px-6">
          <span className="mr-2 whitespace-nowrap text-lg font-bold tracking-tight">
            <span className="text-accent">◉</span> DJ Set Planner
          </span>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={!!t.phase}
                onClick={() => setTab(t.id)}
                title={t.phase ? `Kommer i fase ${t.phase}` : undefined}
                className={`min-h-11 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition ${tab === t.id ? 'bg-panel2 text-accent' : 'text-slate-300 hover:bg-panel2'} disabled:cursor-not-allowed disabled:opacity-35`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <Button variant="ghost" onClick={() => setHelpOpen(true)} aria-label="Hurtigtaster" className="hidden sm:inline-flex">
            ?
          </Button>
          <Button variant="ghost" onClick={() => setDataOpen(true)}>
            Data
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6">{tab === 'library' && <LibraryView />}</main>

      <DataDialog open={dataOpen} onClose={() => setDataOpen(false)} />

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Hurtigtaster">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          {[
            ['/', 'Søk i biblioteket'],
            ['N', 'Ny låt'],
            ['F', 'Vis/skjul filtre'],
            ['Esc', 'Lukk dialog / fjern valg'],
            ['Ctrl+Enter', 'Lagre låt i skjemaet'],
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

function DataDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [msg, setMsg] = useState('');

  return (
    <Modal open={open} onClose={onClose} title="Backup og data">
      <div className="flex flex-col gap-5 text-sm">
        <p className="text-muted">
          Alt lagres lokalt i denne nettleseren (IndexedDB) på denne enheten. Ta backup jevnlig — og bruk backup-filen for å flytte biblioteket mellom PC og mobil.
        </p>
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">Eksporter</h3>
          <Button
            variant="primary"
            onClick={async () => {
              const b = await createBackup();
              downloadJson(b, `dj-set-planner-backup-${new Date().toISOString().slice(0, 10)}.json`);
              setMsg(`Eksporterte ${b.tables.tracks.length} låter.`);
            }}
          >
            Last ned backup (.json)
          </Button>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">Importer backup</h3>
          <div className="flex gap-2">
            {(['merge', 'replace'] as const).map((m) => (
              <label key={m} className={`flex min-h-11 flex-1 items-center gap-2 rounded-lg border px-3 ${mode === m ? 'border-accent' : 'border-line'}`}>
                <input type="radio" className="accent-cyan-400" checked={mode === m} onChange={() => setMode(m)} />
                {m === 'merge' ? 'Slå sammen' : 'Erstatt alt'}
              </label>
            ))}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                const n = await restoreBackup(JSON.parse(await file.text()), mode);
                setMsg(`Importerte ${n} låter (${mode === 'merge' ? 'slått sammen' : 'erstattet'}).`);
              } catch (err) {
                setMsg(`Feil: ${err instanceof Error ? err.message : String(err)}`);
              }
            }}
          />
          <Button onClick={() => fileRef.current?.click()}>Velg backup-fil …</Button>
        </section>
        {msg && <p className="rounded-lg bg-panel2 px-3 py-2">{msg}</p>}
      </div>
    </Modal>
  );
}
