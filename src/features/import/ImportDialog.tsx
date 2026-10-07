import { useMemo, useRef, useState } from 'react';
import type { NewTrack, Track, TrackStatus } from '../../db/types';
import { addTracks } from '../../db/tracks';
import { Button, Field, KeyBadge, Modal, SuggestInput, TagInput } from '../../components/ui';
import { parseTextList } from '../../importers/textList';
import { importCsv, type CsvImportResult } from '../../importers/csvImport';
import { makeDupKey } from '../../lib/normalize';
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
      const prepared = toImport.map((t) => ({
        ...t,
        status,
        genre: t.genre || genre,
        tags: Array.from(new Set([...(t.tags ?? []), ...extraTags])),
      }));
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
      title="Importer låter"
      footer={
        <>
          <span className="mr-auto self-center text-sm text-muted">
            {toImport.length} låter importeres
            {rows.length !== toImport.length && ` · ${rows.length - toImport.length} finnes allerede`}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" disabled={!toImport.length || busy} onClick={doImport}>
            Importer {toImport.length || ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          {(
            [
              ['paste', 'Lim inn liste'],
              ['csv', 'CSV-fil (Exportify m.m.)'],
            ] as const
          ).map(([m, label]) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`min-h-11 flex-1 rounded-lg border text-sm font-medium ${mode === m ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-panel2 text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>

        {mode === 'paste' ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">Én låt per linje, f.eks. «Chicane - Saltwater» eller «Eric Prydz – Opus (Original Mix)». Nummerering og lengde på slutten ignoreres.</p>
            <textarea className="input min-h-44 font-mono text-sm" placeholder={'Paul van Dyk - For An Angel (PvD E-Werk Club Mix)\nChicane - Saltwater\nEric Prydz - Opus'} value={text} onChange={(e) => setText(e.target.value)} />
            <label className="flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-cyan-400" checked={order === 'title-artist'} onChange={(e) => setOrder(e.target.checked ? 'title-artist' : 'artist-title')} />
              Listen er «Tittel - Artist» (byttet om)
            </label>
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <div className="rounded-lg border border-line bg-panel2 p-3 text-slate-300">
              <p className="font-medium text-slate-100">Fra Spotify:</p>
              <ol className="ml-5 mt-1 list-decimal space-y-1">
                <li>
                  Gå til{' '}
                  <a className="text-accent underline" href="https://exportify.net" target="_blank" rel="noreferrer">
                    exportify.net
                  </a>{' '}
                  og logg inn med Spotify.
                </li>
                <li>Trykk «Export» ved spillelisten du vil ha, og last ned CSV-filen.</li>
                <li>Velg filen her. Har filen tempo, key og energi, tas de med automatisk.</li>
              </ol>
              <p className="mt-2 text-muted">Fungerer også med CSV fra TuneMyMusic, Soundiiz, Rekordbox og vanlige regneark (kolonner som Artist, Tittel/Title, BPM, Key).</p>
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
            <Button onClick={() => fileRef.current?.click()}>{csv ? `Valgt: ${csv.fileName} — velg en annen …` : 'Velg CSV-fil …'}</Button>
            {csv?.error && <p className="rounded-lg bg-red-900/50 px-3 py-2 text-red-200">{csv.error}</p>}
            {csv && !csv.error && (
              <p className="text-muted">
                Fant {csv.tracks.length} låter{csv.skipped ? ` (${csv.skipped} rader uten artist/tittel hoppet over)` : ''}. Med BPM: {csv.hasAudioFeatures.bpm}, med key: {csv.hasAudioFeatures.key}, med energi: {csv.hasAudioFeatures.energy}.
              </p>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status for importerte låter">
            <div className="flex gap-2">
              {(
                [
                  ['wishlist', '⬇ Må skaffes'],
                  ['owned', '✓ Har filen'],
                ] as const
              ).map(([s, label]) => (
                <button key={s} type="button" onClick={() => setStatus(s)} className={`min-h-11 flex-1 rounded-lg border text-sm ${status === s ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-panel2 text-slate-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Sjanger (der filen ikke har en)">
            <SuggestInput value={genre} onChange={setGenre} suggestions={genres} placeholder="f.eks. Trance" />
          </Field>
          <Field label="Legg til tagger" className="sm:col-span-2">
            <TagInput value={extraTags} onChange={setExtraTags} suggestions={tags} />
          </Field>
        </div>

        <div className="flex flex-col gap-1">
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-cyan-400" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
            Hopp over låter som allerede finnes i biblioteket
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-cyan-400" checked={lookup} onChange={(e) => setLookup(e.target.checked)} />
            Hent BPM, key og lengde fra nett etterpå (for låter som mangler det)
          </label>
          {lookup && !settings.getSongBpmKey && (
            <p className="rounded-lg bg-amber-900/40 px-3 py-2 text-sm text-amber-200">
              Uten GetSongBPM-nøkkel får du ingen key og bare litt BPM (fra Deezer). Legg inn nøkkelen under <strong>Innstillinger</strong> først for best resultat.
            </p>
          )}
        </div>

        {problems.length > 0 && (
          <details className="rounded-lg bg-amber-900/30 px-3 py-2 text-sm text-amber-200">
            <summary className="cursor-pointer">{problems.length} linjer kunne ikke tolkes</summary>
            <ul className="mt-2 space-y-1">
              {problems.slice(0, 30).map((p) => (
                <li key={p.line}>
                  Linje {p.line}: «{p.raw.trim().slice(0, 80)}» — {p.problem}
                </li>
              ))}
            </ul>
          </details>
        )}

        {rows.length > 0 && (
          <div className="max-h-72 overflow-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-panel2 text-left text-muted">
                <tr>
                  <th className="px-3 py-2">Artist</th>
                  <th className="px-3 py-2">Tittel</th>
                  <th className="px-3 py-2">Versjon</th>
                  <th className="px-3 py-2 text-right">BPM</th>
                  <th className="px-3 py-2">Key</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 300).map((t, i) => {
                  const dup = isExisting(t);
                  return (
                    <tr key={i} className={`border-t border-line ${dup && skipExisting ? 'opacity-40' : ''}`}>
                      <td className="px-3 py-1.5">{t.artist}</td>
                      <td className="px-3 py-1.5">{t.title}</td>
                      <td className="px-3 py-1.5 text-muted">{t.version}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{t.bpm ?? ''}</td>
                      <td className="px-3 py-1.5">{t.camelot ? <KeyBadge camelot={t.camelot} /> : ''}</td>
                      <td className="px-3 py-1.5 text-xs text-amber-300">{dup ? 'finnes' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > 300 && <p className="px-3 py-2 text-xs text-muted">… og {rows.length - 300} til</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}
