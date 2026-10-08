import { useMemo, useRef, useState } from 'react';
import { Check, ClipboardList, Download, FileSpreadsheet } from 'lucide-react';
import type { NewTrack, Track, TrackStatus } from '../../db/types';
import { addTracks } from '../../db/tracks';
import { Button, Field, KeyBadge, Modal, Segmented, SuggestInput, TagInput } from '../../components/ui';
import { parseTextList } from '../../importers/textList';
import { importCsv, type CsvImportResult } from '../../importers/csvImport';
import { makeDupKey } from '../../lib/normalize';
import { href } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { startBulkLookup } from '../../sources/bulkStore';

type Mode = 'paste' | 'csv';

export function ImportDialog({ open, onClose, existing, genres, tags }: { open: boolean; onClose: () => void; existing: Track[]; genres: string[]; tags: string[] }) {
  const [mode, setMode] = useState<Mode>('paste');
  const [text, setText] = useState('');
  const [order, setOrder] = useState<'artist-title' | 'title-artist'>('artist-title');
  const [csv, setCsv] = useState<(CsvImportResult & { fileName: string }) | null>(null);
  const [status, setStatus] = useState<TrackStatus>('wishlist');
  const [genre, setGenre] = useState('');
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const [skipExisting, setSkipExisting] = useState(true);
  const [lookup, setLookup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [settings] = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  const existingKeys = useMemo(() => new Set(existing.map((t) => t.dupKey)), [existing]);
  const parsedPaste = useMemo(() => (mode === 'paste' ? parseTextList(text, { order }) : []), [mode, text, order]);
  const rows: NewTrack[] = mode === 'paste' ? parsedPaste.flatMap((p) => (p.track ? [p.track] : [])) : (csv?.tracks ?? []);
  const problems = mode === 'paste' ? parsedPaste.filter((p) => !p.track) : [];
  const isExisting = (t: NewTrack) => existingKeys.has(makeDupKey(t.artist, t.title, t.version ?? ''));
  const toImport = rows.filter((t) => !(skipExisting && isExisting(t)));

  async function doImport() {
    setBusy(true);
    try {
      const prepared = toImport.map((t) => ({ ...t, status, genre: t.genre || genre, tags: Array.from(new Set([...(t.tags ?? []), ...extraTags])) }));
      const added = await addTracks(prepared);
      if (lookup) startBulkLookup(added.filter((t) => t.bpm == null || t.camelot == null).map((t) => t.id));
      setText('');
      setCsv(null);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Import tracks"
      footer={
        <>
          <span className="mr-auto text-[13px] text-muted">
            {toImport.length} track{toImport.length === 1 ? '' : 's'} will be imported
            {rows.length !== toImport.length && ` · ${rows.length - toImport.length} already in your library`}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!toImport.length || busy} onClick={doImport}>
            Import {toImport.length || ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Segmented
          className="w-full"
          value={mode}
          onChange={setMode}
          options={[
            {
              value: 'paste',
              label: (
                <>
                  <ClipboardList size={15} /> Paste a list
                </>
              ),
            },
            {
              value: 'csv',
              label: (
                <>
                  <FileSpreadsheet size={15} /> CSV file
                </>
              ),
            },
          ]}
        />

        {mode === 'paste' ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-muted">One track per line, like “Chicane - Saltwater” or “Eric Prydz – Opus (Original Mix)”. Numbering and lengths at the end are ignored.</p>
            <textarea className="input min-h-44 font-mono text-[13px]" placeholder={'Paul van Dyk - For An Angel (PvD E-Werk Club Mix)\nChicane - Saltwater\nEric Prydz - Opus'} value={text} onChange={(e) => setText(e.target.value)} aria-label="Track list" />
            <label className="flex min-h-9 items-center gap-2 text-sm text-ink2">
              <input type="checkbox" className="h-[18px] w-[18px] accent-[#ef6a3a]" checked={order === 'title-artist'} onChange={(e) => setOrder(e.target.checked ? 'title-artist' : 'artist-title')} />
              My list is “Title - Artist” (reversed)
            </label>
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <div className="rounded-2xl border border-line bg-sidebar/60 p-4 text-ink2">
              <p className="font-medium text-ink">From a Spotify playlist</p>
              <ol className="ml-5 mt-2 list-decimal space-y-1 text-[13px]">
                <li>
                  Go to{' '}
                  <a className="text-accent hover:underline" href="https://exportify.net" target="_blank" rel="noreferrer">
                    exportify.net
                  </a>{' '}
                  and sign in with Spotify.
                </li>
                <li>Click “Export” next to the playlist and download the CSV.</li>
                <li>Choose the file here. Tempo, key and energy are included if the file has them.</li>
              </ol>
              <p className="mt-2 text-[13px] text-muted">Also works with CSVs from TuneMyMusic, Soundiiz, Rekordbox and plain spreadsheets (columns like Artist, Title, BPM, Key).</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) setCsv({ ...importCsv(await f.text()), fileName: f.name });
              }}
            />
            <Button onClick={() => fileRef.current?.click()}>{csv ? `${csv.fileName} — choose another…` : 'Choose CSV file…'}</Button>
            {csv?.error && <p className="rounded-xl bg-bad/15 px-4 py-2.5 text-[#f0a3a3]">{csv.error}</p>}
            {csv && !csv.error && (
              <p className="text-[13px] text-muted">
                Found {csv.tracks.length} tracks{csv.skipped ? ` (${csv.skipped} rows without artist/title skipped)` : ''}. With BPM: {csv.hasAudioFeatures.bpm} · with key: {csv.hasAudioFeatures.key} · with energy: {csv.hasAudioFeatures.energy}.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Imported tracks are" group>
            <Segmented
              value={status}
              onChange={setStatus}
              options={[
                {
                  value: 'wishlist',
                  label: (
                    <>
                      <Download size={15} /> To get
                    </>
                  ),
                },
                {
                  value: 'owned',
                  label: (
                    <>
                      <Check size={15} /> Owned
                    </>
                  ),
                },
              ]}
            />
          </Field>
          <Field label="Genre (when the file has none)">
            <SuggestInput value={genre} onChange={setGenre} suggestions={genres} placeholder="e.g. Trance" />
          </Field>
          <Field label="Add tags" className="sm:col-span-2" group>
            <TagInput value={extraTags} onChange={setExtraTags} suggestions={tags} />
          </Field>
        </div>

        <div className="flex flex-col gap-1">
          <label className="flex min-h-10 items-center gap-3 text-sm text-ink2">
            <input type="checkbox" className="h-[18px] w-[18px] accent-[#ef6a3a]" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
            Skip tracks already in my library
          </label>
          <label className="flex min-h-10 items-center gap-3 text-sm text-ink2">
            <input type="checkbox" className="h-[18px] w-[18px] accent-[#ef6a3a]" checked={lookup} onChange={(e) => setLookup(e.target.checked)} />
            Look up BPM, key and length online afterwards (for tracks missing them)
          </label>
          {lookup && !settings.getSongBpmKey && (
            <p className="rounded-xl bg-ok/10 px-4 py-2.5 text-[13px] text-ok">
              Without a GetSongBPM key you’ll get no key and only some BPM (from Deezer).{' '}
              <a href={href({ name: 'settings' })} onClick={onClose} className="underline">
                Add your key in Settings
              </a>{' '}
              first for best results.
            </p>
          )}
        </div>

        {problems.length > 0 && (
          <details className="rounded-xl bg-ok/10 px-4 py-2.5 text-[13px] text-ok">
            <summary className="cursor-pointer">
              {problems.length} line{problems.length === 1 ? '' : 's'} couldn’t be read
            </summary>
            <ul className="mt-2 space-y-1">
              {problems.slice(0, 30).map((p) => (
                <li key={p.line}>
                  Line {p.line}: “{p.raw.trim().slice(0, 80)}” — {p.problem}
                </li>
              ))}
            </ul>
          </details>
        )}

        {rows.length > 0 && (
          <div className="max-h-72 overflow-auto rounded-2xl border border-line">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-raised text-left text-muted">
                <tr>
                  <th className="px-3 py-2 font-normal">Artist</th>
                  <th className="px-3 py-2 font-normal">Title</th>
                  <th className="px-3 py-2 font-normal">Version</th>
                  <th className="px-3 py-2 text-right font-normal">BPM</th>
                  <th className="px-3 py-2 font-normal">Key</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 300).map((t, i) => {
                  const dup = isExisting(t);
                  return (
                    <tr key={i} className={`border-t border-line/60 ${dup && skipExisting ? 'opacity-40' : ''}`}>
                      <td className="px-3 py-1.5">{t.artist}</td>
                      <td className="px-3 py-1.5">{t.title}</td>
                      <td className="px-3 py-1.5 text-muted">{t.version}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{t.bpm ?? ''}</td>
                      <td className="px-3 py-1.5">{t.camelot ? <KeyBadge camelot={t.camelot} link={false} /> : ''}</td>
                      <td className="px-3 py-1.5 text-xs text-muted">{dup ? 'in library' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > 300 && <p className="px-3 py-2 text-xs text-muted">…and {rows.length - 300} more</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}
