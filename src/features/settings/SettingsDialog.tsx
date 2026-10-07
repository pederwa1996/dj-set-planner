import { useRef, useState } from 'react';
import { Button, Field, Modal } from '../../components/ui';
import { createBackup, downloadJson, restoreBackup } from '../../db/backup';
import { useSettings } from '../../lib/settings';
import { lookupTrack } from '../../sources/lookup';
import { getSongBpmAdapter } from '../../sources/getsongbpm';
import { deezerAdapter } from '../../sources/deezer';
import { musicBrainzAdapter } from '../../sources/musicbrainz';
import type { SourceAdapter } from '../../sources/types';

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [settings, save] = useSettings();
  const [keyDraft, setKeyDraft] = useState(settings.getSongBpmKey);
  const [testMsg, setTestMsg] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [msg, setMsg] = useState('');

  async function test(name: string, adapter: SourceAdapter) {
    setTestMsg((m) => ({ ...m, [name]: 'Tester …' }));
    try {
      const r = await lookupTrack({ artist: 'Daft Punk', title: 'One More Time' }, undefined, [adapter]);
      const c = r.candidates[0];
      setTestMsg((m) => ({
        ...m,
        [name]: r.errors.length ? `✗ ${r.errors[0].message}` : c ? `✓ Virker (testlåt: ${c.bpm ? `${c.bpm} BPM` : 'ingen BPM'}${c.camelot ? `, ${c.camelot}` : ''})` : '✓ Svarer, men fant ikke testlåten',
      }));
    } catch (e) {
      setTestMsg((m) => ({ ...m, [name]: `✗ ${e instanceof Error ? e.message : String(e)}` }));
    }
  }

  const sourceRow = (id: keyof typeof settings.sources, title: string, desc: string, adapter: SourceAdapter | null) => (
    <div className="flex flex-col gap-1 rounded-lg border border-line p-3">
      <label className="flex min-h-9 items-center gap-3">
        <input type="checkbox" className="h-5 w-5 accent-cyan-400" checked={settings.sources[id]} onChange={(e) => save({ ...settings, sources: { ...settings.sources, [id]: e.target.checked } })} />
        <span className="font-medium">{title}</span>
        {adapter && (
          <Button variant="ghost" className="ml-auto !min-h-9 !px-3 text-xs" onClick={() => test(id, adapter)}>
            Test
          </Button>
        )}
      </label>
      <p className="text-xs text-muted">{desc}</p>
      {testMsg[id] && <p className="text-xs">{testMsg[id]}</p>}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Innstillinger og data" wide>
      <div className="flex flex-col gap-6 text-sm">
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-semibold">Hente data fra nett</h3>
          <Field
            label="GetSongBPM API-nøkkel (gir BPM og key)"
            hint={
              <>
                Gratis på{' '}
                <a className="text-accent underline" href="https://getsongbpm.com/api" target="_blank" rel="noreferrer">
                  getsongbpm.com/api
                </a>
                . Nøkkelen lagres bare i denne nettleseren og havner aldri i koden eller backupen.
              </>
            }
          >
            <div className="flex gap-2">
              <input className="input flex-1 font-mono" type="password" autoComplete="off" placeholder="lim inn nøkkelen her" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value.trim())} />
              <Button variant="primary" disabled={keyDraft === settings.getSongBpmKey} onClick={() => save({ ...settings, getSongBpmKey: keyDraft })}>
                Lagre
              </Button>
            </div>
          </Field>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {sourceRow('getsongbpm', 'GetSongBPM', 'BPM og key. Krever nøkkel. Maks 3000 oppslag i timen.', settings.getSongBpmKey ? getSongBpmAdapter(settings.getSongBpmKey) : null)}
            {sourceRow('deezer', 'Deezer', 'Lengde, år, label, sjanger og noen ganger BPM. Ingen nøkkel.', deezerAdapter)}
            {sourceRow('musicbrainz', 'MusicBrainz', 'Lengde, første utgivelsesår og versjoner. Ingen nøkkel.', musicBrainzAdapter)}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Backup</h3>
          <p className="text-muted">Alt lagres lokalt i denne nettleseren på denne enheten. Ta backup jevnlig — og bruk filen for å flytte biblioteket mellom PC og mobil.</p>
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
          <div className="mt-2 flex gap-2">
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
                setMsg(`Importerte backup med ${n} låter (${mode === 'merge' ? 'slått sammen' : 'erstattet'}).`);
              } catch (err) {
                setMsg(`Feil: ${err instanceof Error ? err.message : String(err)}`);
              }
            }}
          />
          <Button onClick={() => fileRef.current?.click()}>Importer backup-fil …</Button>
          {msg && <p className="rounded-lg bg-panel2 px-3 py-2">{msg}</p>}
        </section>

        <p className="text-xs text-muted">
          BPM- og key-data fra{' '}
          <a className="underline" href="https://getsongbpm.com" target="_blank" rel="noreferrer">
            GetSongBPM.com
          </a>
          . Metadata fra Deezer og MusicBrainz.
        </p>
      </div>
    </Modal>
  );
}
