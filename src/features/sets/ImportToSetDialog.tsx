import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Download, ListOrdered, Loader2, Wand2 } from 'lucide-react';
import { db } from '../../db/db';
import { upsertImportedTracks } from '../../db/tracks';
import type { TrackStatus } from '../../db/types';
import { Button, Field, Modal, Segmented } from '../../components/ui';
import type { PlaylistFile } from '../../importers/playlistFile';
import { makeDupKey } from '../../lib/normalize';
import { href } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { startBulkLookup } from '../../sources/bulkStore';
import { SetLengthFields } from './SetLengthFields';
import { getLengthDefaults, saveLengthDefaults, type LengthChoice } from './setLength';

export type PlacementMode = 'pool' | 'order';

export interface ImportToSetResult {
  ids: string[];
  mode: PlacementMode;
  name: string;
  /** Lengde og spilletid for et nytt set (null når låtene legges i et eksisterende set) */
  length: LengthChoice | null;
}

/** Bekreft import av en spillelistefil (Exportify-CSV) til et nytt eller eksisterende set. */
export function ImportToSetDialog({
  file,
  onClose,
  onConfirm,
  forNewSet,
}: {
  file: PlaylistFile | null;
  onClose: () => void;
  onConfirm: (r: ImportToSetResult) => void | Promise<void>;
  forNewSet: boolean;
}) {
  const tracks = useLiveQuery(() => db.tracks.toArray(), []);
  const [settings] = useSettings();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<PlacementMode>('pool');
  const [status, setStatus] = useState<TrackStatus>('wishlist');
  const [lookup, setLookup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [length, setLength] = useState<LengthChoice>(getLengthDefaults);

  useEffect(() => {
    if (file) {
      setName(file.name);
      setBusy(false);
      setLength(getLengthDefaults());
    }
  }, [file]);

  const summary = useMemo(() => {
    if (!file || !tracks) return null;
    const existing = new Set(tracks.map((t) => t.dupKey));
    const keys = new Set<string>();
    const durations: (number | null)[] = [];
    let inLibrary = 0;
    for (const t of file.tracks) {
      const k = makeDupKey(t.artist, t.title, t.version ?? '');
      if (keys.has(k)) continue;
      keys.add(k);
      durations.push(t.durationSec ?? null);
      if (existing.has(k)) inLibrary++;
    }
    return { unique: keys.size, inLibrary, doubles: file.tracks.length - keys.size, durations };
  }, [file, tracks]);

  async function confirm() {
    if (!file) return;
    setBusy(true);
    try {
      const r = await upsertImportedTracks(file.tracks, { status });
      if (lookup) {
        const added = await db.tracks.bulkGet(r.ids);
        const missing = added.filter((t) => t && (t.bpm == null || t.camelot == null) && !t.online).map((t) => t!.id);
        if (missing.length) startBulkLookup(missing);
      }
      if (forNewSet) saveLengthDefaults(length);
      await onConfirm({ ids: r.ids, mode, name: name.trim() || file.name, length: forNewSet ? length : null });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const ok = file && !file.error && file.tracks.length > 0;

  return (
    <Modal
      open={!!file}
      onClose={onClose}
      title={forNewSet ? 'New set from a playlist' : 'Add a playlist to this set'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!ok || busy} onClick={confirm}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {forNewSet ? 'Create set' : `Add ${summary?.unique ?? ''} tracks`}
          </Button>
        </>
      }
    >
      {!file ? null : file.error ? (
        <p className="rounded-xl bg-bad/15 px-4 py-3 text-sm text-[#f0a3a3]">{file.error}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {summary && (
            <div className="rounded-2xl border border-line bg-sidebar/60 p-4 text-sm">
              <div className="serif text-lg">{file.name}</div>
              <div className="mt-1 text-ink2">
                {summary.unique} track{summary.unique === 1 ? '' : 's'}
                {summary.inLibrary > 0 && ` · ${summary.inLibrary} already in your library`}
                {summary.doubles > 0 && ` · ${summary.doubles} listed twice (added once)`}
              </div>
              <div className="mt-1 text-[13px] text-muted">
                From the file: {file.withData.bpm} with BPM · {file.withData.key} with key · {file.withData.energy} with energy
              </div>
            </div>
          )}

          {forNewSet && (
            <Field label="Set name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          )}

          <Field label="Order" group>
            <Segmented
              className="w-full"
              value={mode}
              onChange={setMode}
              options={[
                {
                  value: 'pool',
                  label: (
                    <>
                      <Wand2 size={15} /> Let the engine order them
                    </>
                  ),
                },
                {
                  value: 'order',
                  label: (
                    <>
                      <ListOrdered size={15} /> Keep playlist order
                    </>
                  ),
                },
              ]}
            />
            <span className="text-xs text-muted">
              {mode === 'pool' ? 'The tracks go into the pool. Press “Build order” to get three suggestions by key, BPM and energy.' : 'The tracks go straight into the set in the same order as the playlist. You can still rebuild later.'}
            </span>
          </Field>

          {forNewSet && <SetLengthFields value={length} onChange={setLength} durations={summary?.durations} keepAll={mode === 'order'} />}

          <Field label="New tracks are" group hint="Tracks already in your library keep their status.">
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

          <label className="flex min-h-10 items-center gap-3 text-sm text-ink2">
            <input type="checkbox" className="h-[18px] w-[18px] accent-[#ef6a3a]" checked={lookup} onChange={(e) => setLookup(e.target.checked)} />
            Look up missing BPM and key online
          </label>
          {lookup && !settings.getSongBpmKey && (
            <p className="-mt-3 text-[13px] text-ok">
              Add your GetSongBPM key in{' '}
              <a href={href({ name: 'settings' })} className="underline" onClick={onClose}>
                Settings
              </a>{' '}
              to get keys — without it you’ll only get some BPM.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
