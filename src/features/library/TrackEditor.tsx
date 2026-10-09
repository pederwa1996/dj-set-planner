import { useEffect, useState } from 'react';
import { Check, Download, Trash2 } from 'lucide-react';
import type { Track } from '../../db/types';
import { keyChecked, keySourceLabel } from '../../lib/keySource';
import { addTrack, deleteTracks, emptyTrack, updateTrack } from '../../db/tracks';
import { Button, EnergyPicker, Field, KeyInput, Modal, NumberInput, Segmented, Stars, SuggestInput, TagInput } from '../../components/ui';
import { formatDuration, parseDuration } from '../../lib/normalize';
import { OnlineLookupPanel } from './OnlineLookupPanel';

type Draft = Omit<Track, 'id' | 'dupKey' | 'createdAt' | 'updatedAt'>;

export interface EditorSuggestions {
  genres: string[];
  subgenres: string[];
  tags: string[];
  moods: string[];
}

export function TrackEditor({
  open,
  track,
  onClose,
  suggestions,
  duplicateOf,
}: {
  open: boolean;
  track: Track | null; // null = ny låt
  onClose: () => void;
  suggestions: EditorSuggestions;
  duplicateOf?: (artist: string, title: string, version: string) => Track[];
}) {
  const [d, setD] = useState<Draft>(emptyTrack());
  const [duration, setDuration] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = track ? { ...track } : emptyTrack();
    setD(base);
    setDuration(formatDuration(base.durationSec));
    setError('');
    setConfirmDelete(false);
  }, [open, track]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const dups = duplicateOf && d.artist && d.title ? duplicateOf(d.artist, d.title, d.version).filter((x) => x.id !== track?.id) : [];

  async function save(addAnother = false) {
    if (!d.artist.trim() || !d.title.trim()) {
      setError('Artist and title are required.');
      return;
    }
    setSaving(true);
    try {
      const data: Draft = { ...d, durationSec: parseDuration(duration) };
      if (track) await updateTrack(track.id, data);
      else await addTrack(data);
      if (addAnother) {
        // Behold sjanger/status/tagger for rask registrering av flere låter
        setD({ ...emptyTrack(), genre: d.genre, subgenre: d.subgenre, status: d.status, tags: d.tags });
        setDuration('');
        setError('');
        (document.querySelector('[data-autofocus]') as HTMLInputElement | null)?.focus();
      } else onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={track ? 'Edit track' : 'New track'}
      footer={
        confirmDelete ? (
          <>
            <span className="mr-auto text-sm text-ink2">Delete this track? This can’t be undone.</span>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await deleteTracks([track!.id]);
                onClose();
              }}
            >
              Delete
            </Button>
          </>
        ) : (
          <>
            {track && (
              <Button variant="ghost" className="mr-auto text-bad" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} /> Delete
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {!track && (
              <Button onClick={() => save(true)} disabled={saving}>
                Save & add another
              </Button>
            )}
            <Button variant="primary" onClick={() => save()} disabled={saving}>
              Save <kbd className="hidden text-[11px] opacity-50 sm:inline">Ctrl ↵</kbd>
            </Button>
          </>
        )
      }
    >
      <form
        className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            save();
          }
        }}
      >
        {error && <p className="rounded-xl bg-bad/15 px-4 py-2.5 text-sm text-[#f0a3a3] sm:col-span-6">{error}</p>}

        <div className="sm:col-span-6">
          <Segmented
            value={d.status}
            onChange={(s) => set('status', s)}
            options={[
              {
                value: 'owned',
                label: (
                  <>
                    <Check size={15} /> I have the file
                  </>
                ),
              },
              {
                value: 'wishlist',
                label: (
                  <>
                    <Download size={15} /> To get
                  </>
                ),
              },
            ]}
          />
        </div>

        <Field label="Artist" className="sm:col-span-3">
          <input data-autofocus autoFocus className="input" value={d.artist} onChange={(e) => set('artist', e.target.value)} />
        </Field>
        <Field label="Title" className="sm:col-span-3">
          <input className="input" value={d.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        {dups.length > 0 && (
          <p className="rounded-xl bg-ok/10 px-4 py-2.5 text-sm text-ok sm:col-span-6">
            Looks like a duplicate of: {dups.map((x) => `${x.artist} – ${x.title}${x.version ? ` (${x.version})` : ''}`).join('; ')}
          </p>
        )}
        <div className="sm:col-span-6">
          <OnlineLookupPanel
            draft={d}
            onApply={(ch) => {
              setD((prev) => ({ ...prev, ...ch }));
              if (ch.durationSec != null) setDuration(formatDuration(ch.durationSec));
            }}
          />
        </div>
        <Field label="Remix / version" className="sm:col-span-2">
          <input className="input" placeholder="Original Mix" value={d.version} onChange={(e) => set('version', e.target.value)} />
        </Field>
        <Field label="Label" className="sm:col-span-2">
          <input className="input" value={d.label} onChange={(e) => set('label', e.target.value)} />
        </Field>
        <Field label="Year" className="sm:col-span-1">
          <NumberInput value={d.year} onChange={(v) => set('year', v == null ? null : Math.round(v))} />
        </Field>
        <Field label="Length" className="sm:col-span-1">
          <input className="input" inputMode="numeric" placeholder="6:30" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>

        <Field label="BPM" className="sm:col-span-2" hint={d.analysis?.bpm ? `Analysis suggests ${d.analysis.bpm}` : undefined}>
          <NumberInput value={d.bpm} step="0.01" placeholder="128.00" onChange={(v) => setD((p) => ({ ...p, bpm: v, sources: { ...p.sources, bpm: 'manual' } }))} />
        </Field>
        <Field
          label="Key — Camelot or musical notation"
          className="sm:col-span-4"
          group
          hint={
            d.camelot ? (
              keyChecked(d) ? (
                <span className="text-[#5fd35f]">✓ {keySourceLabel(d)}</span>
              ) : (
                <>
                  {keySourceLabel(d)} — not checked yet.{' '}
                  <button type="button" className="text-accent hover:underline" onClick={() => setD((p) => ({ ...p, sources: { ...p.sources, camelot: 'manual' } }))}>
                    It’s right
                  </button>
                </>
              )
            ) : undefined
          }
        >
          <KeyInput value={d.camelot} onChange={(v) => setD((p) => ({ ...p, camelot: v, sources: { ...p.sources, camelot: 'manual' } }))} />
        </Field>

        <Field label={`Energy ${d.energy ?? '–'} / 10`} className="sm:col-span-6" group hint="1–3 warm-up · 4–6 groove · 7–8 driving · 9–10 peak">
          <EnergyPicker value={d.energy} onChange={(v) => setD((p) => ({ ...p, energy: v, sources: { ...p.sources, energy: 'manual' } }))} />
        </Field>

        <Field label="Genre" className="sm:col-span-2">
          <SuggestInput value={d.genre} onChange={(v) => set('genre', v)} suggestions={suggestions.genres} />
        </Field>
        <Field label="Subgenre" className="sm:col-span-2">
          <SuggestInput value={d.subgenre} onChange={(v) => set('subgenre', v)} suggestions={suggestions.subgenres} />
        </Field>
        <Field label="Mood" className="sm:col-span-2">
          <SuggestInput value={d.mood} onChange={(v) => set('mood', v)} suggestions={suggestions.moods} placeholder="euphoric, dark…" />
        </Field>

        <Field label="Tags" className="sm:col-span-6" group>
          <TagInput value={d.tags} onChange={(v) => set('tags', v)} suggestions={suggestions.tags} />
        </Field>

        <Field label="Intro (bars)" className="sm:col-span-1">
          <NumberInput value={d.introBars} onChange={(v) => set('introBars', v)} placeholder="32" />
        </Field>
        <Field label="Outro (bars)" className="sm:col-span-1">
          <NumberInput value={d.outroBars} onChange={(v) => set('outroBars', v)} placeholder="32" />
        </Field>
        <Field label="My rating" className="sm:col-span-2" group>
          <Stars value={d.rating} onChange={(v) => set('rating', v)} />
        </Field>
        <Field label="Times played" className="sm:col-span-1">
          <NumberInput value={d.playCount} onChange={(v) => set('playCount', Math.max(0, Math.round(v ?? 0)))} />
        </Field>
        <Field label="Last played" className="sm:col-span-1">
          <input type="date" className="input" value={d.lastPlayedAt?.slice(0, 10) ?? ''} onChange={(e) => set('lastPlayedAt', e.target.value ? new Date(e.target.value).toISOString() : null)} />
        </Field>

        <Field label="Notes" className="sm:col-span-6">
          <textarea className="input min-h-24" value={d.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Breakdown after 3 min, great to mix out of…" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
