import { useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Download, KeyRound, Upload, XCircle } from 'lucide-react';
import { Button, Field, PageHeader, Segmented } from '../../components/ui';
import { db } from '../../db/db';
import { createBackup, downloadJson, restoreBackup } from '../../db/backup';
import { deleteTracks } from '../../db/tracks';
import { useSettings } from '../../lib/settings';
import { lookupTrack } from '../../sources/lookup';
import { getSongBpmAdapter } from '../../sources/getsongbpm';
import { deezerAdapter } from '../../sources/deezer';
import { musicBrainzAdapter } from '../../sources/musicbrainz';
import type { SourceAdapter } from '../../sources/types';
import { AccountSection } from './AccountSection';

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line/70 py-8 md:grid-cols-[260px_minmax(0,1fr)]">
      <div>
        <h2 className="text-base font-medium">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

export function SettingsView() {
  const [settings, save] = useSettings();
  const [keyDraft, setKeyDraft] = useState(settings.getSongBpmKey);
  const [testMsg, setTestMsg] = useState<Record<string, { ok: boolean; text: string } | 'busy'>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [msg, setMsg] = useState('');
  const counts = useLiveQuery(async () => ({ tracks: await db.tracks.count(), sets: await db.sets.count(), samples: await db.tracks.where('tags').anyOf(['sample', 'eksempel']).primaryKeys() }), []);

  async function test(id: string, adapter: SourceAdapter) {
    setTestMsg((m) => ({ ...m, [id]: 'busy' }));
    try {
      const r = await lookupTrack({ artist: 'Daft Punk', title: 'One More Time' }, undefined, [adapter]);
      const c = r.candidates[0];
      setTestMsg((m) => ({
        ...m,
        [id]: r.errors.length
          ? { ok: false, text: r.errors[0].message }
          : { ok: true, text: c ? `Works — test track: ${c.bpm ? `${c.bpm} BPM` : 'no BPM'}${c.camelot ? `, ${c.camelot}` : ''}` : 'Responds, but didn’t find the test track' },
      }));
    } catch (e) {
      setTestMsg((m) => ({ ...m, [id]: { ok: false, text: e instanceof Error ? e.message : String(e) } }));
    }
  }

  const source = (id: keyof typeof settings.sources, title: string, desc: string, adapter: SourceAdapter | null) => {
    const t = testMsg[id];
    return (
      <div className="card flex flex-col gap-2 p-4">
        <div className="flex items-center gap-3">
          <label className="flex min-h-9 flex-1 items-center gap-3">
            <input type="checkbox" className="h-5 w-5 accent-[#ef6a3a]" checked={settings.sources[id]} onChange={(e) => save({ ...settings, sources: { ...settings.sources, [id]: e.target.checked } })} />
            <span className="font-medium">{title}</span>
          </label>
          <Button size="sm" onClick={() => adapter && test(id, adapter)} disabled={!adapter || t === 'busy'}>
            {t === 'busy' ? 'Testing…' : 'Test'}
          </Button>
        </div>
        <p className="text-[13px] text-muted">{desc}</p>
        {t && t !== 'busy' && (
          <p className={`flex items-start gap-1.5 text-[13px] ${t.ok ? 'text-ink2' : 'text-bad'}`}>
            {t.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-good" /> : <XCircle size={15} className="mt-0.5 shrink-0" />}
            {t.text}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" subtitle="Account and sync, online lookup, backup and data." />

      <Section title="Account & sync" description="Save your library and sets in the cloud, so they’re the same on your phone and computer — and never disappear with the browser. The app still works offline.">
        <AccountSection />
      </Section>

      <Section title="Online lookup" description="BPM and key come from GetSongBPM, which needs a free API key. Deezer and MusicBrainz fill in length, year and label without a key.">
        <Field
          label="GetSongBPM API key"
          hint={
            <>
              Get one for free at{' '}
              <a className="text-accent underline-offset-2 hover:underline" href="https://getsongbpm.com/api" target="_blank" rel="noreferrer">
                getsongbpm.com/api
              </a>
              . It’s stored only in this browser — never in the code or in backups.
            </>
          }
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <KeyRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input w-full pl-10 font-mono" type="password" autoComplete="off" placeholder="Paste your key" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value.trim())} />
            </div>
            <Button variant="primary" disabled={keyDraft === settings.getSongBpmKey} onClick={() => save({ ...settings, getSongBpmKey: keyDraft })}>
              Save
            </Button>
          </div>
        </Field>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {source('getsongbpm', 'GetSongBPM', 'BPM and key. Needs a key. Max 3,000 lookups per hour.', settings.getSongBpmKey ? getSongBpmAdapter(settings.getSongBpmKey) : null)}
          {source('deezer', 'Deezer', 'Length, year, label, genre and sometimes BPM. No key needed.', deezerAdapter)}
          {source('musicbrainz', 'MusicBrainz', 'Length, first release year and versions. No key needed.', musicBrainzAdapter)}
        </div>
      </Section>

      <Section title="Backup" description="A safety copy of everything (tracks, sets, notes) as one file. Handy before big changes — your cloud account already keeps devices in sync.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={async () => {
              const b = await createBackup();
              downloadJson(b, `dj-set-planner-backup-${new Date().toISOString().slice(0, 10)}.json`);
              setMsg(`Exported ${b.tables.tracks.length} tracks and ${b.tables.sets?.length ?? 0} sets.`);
            }}
          >
            <Download size={16} /> Download backup
          </Button>
        </div>
        <Field label="Restore from a backup file" group>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'merge', label: 'Merge with current' },
                { value: 'replace', label: 'Replace everything' },
              ]}
            />
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Choose file…
            </Button>
          </div>
        </Field>
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
              setMsg(`Restored a backup with ${n} tracks (${mode === 'merge' ? 'merged' : 'replaced'}).`);
            } catch (err) {
              setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
            }
          }}
        />
        {msg && <p className="rounded-xl bg-raised px-4 py-3 text-sm">{msg}</p>}
      </Section>

      <Section title="Data" description="What’s on this device right now (also stored in the cloud when you’re signed in).">
        <p className="text-sm text-ink2">{counts ? `${counts.tracks} tracks · ${counts.sets} sets` : '…'}</p>
        {counts && counts.samples.length > 0 && (
          <div>
            <Button onClick={() => deleteTracks(counts.samples as string[])}>Remove the {counts.samples.length} sample tracks</Button>
          </div>
        )}
      </Section>

      <Section title="About">
        <p className="text-sm text-muted">
          BPM and key data from{' '}
          <a className="text-ink2 underline underline-offset-2" href="https://getsongbpm.com" target="_blank" rel="noreferrer">
            GetSongBPM.com
          </a>
          . Metadata from Deezer and MusicBrainz.
        </p>
      </Section>
    </div>
  );
}
