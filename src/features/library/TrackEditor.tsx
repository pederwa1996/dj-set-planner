import { useEffect, useState } from 'react';
import type { Track } from '../../db/types';
import { addTrack, emptyTrack, updateTrack } from '../../db/tracks';
import { Button, EnergyPicker, Field, KeyInput, Modal, NumberInput, Stars, SuggestInput, TagInput } from '../../components/ui';
import { formatDuration, parseDuration } from '../../lib/normalize';

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
  onDelete,
  duplicateOf,
}: {
  open: boolean;
  track: Track | null; // null = ny låt
  onClose: () => void;
  suggestions: EditorSuggestions;
  onDelete?: (t: Track) => void;
  duplicateOf?: (artist: string, title: string, version: string) => Track[];
}) {
  const [d, setD] = useState<Draft>(emptyTrack());
  const [duration, setDuration] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const base = track ? { ...track } : emptyTrack();
    setD(base);
    setDuration(formatDuration(base.durationSec));
    setError('');
  }, [open, track]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const dups = duplicateOf && d.artist && d.title ? duplicateOf(d.artist, d.title, d.version).filter((x) => x.id !== track?.id) : [];

  async function save(addAnother = false) {
    if (!d.artist.trim() || !d.title.trim()) {
      setError('Artist og tittel må fylles ut.');
      return;
    }
    setSaving(true);
    try {
      const data: Draft = { ...d, durationSec: parseDuration(duration) };
      // Manuelt satt BPM/key markeres som manuelle
      if (!track || track.bpm !== data.bpm) data.sources = { ...data.sources, bpm: 'manual' };
      if (!track || track.camelot !== data.camelot) data.sources = { ...data.sources, camelot: 'manual' };
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
      title={track ? 'Rediger låt' : 'Ny låt'}
      footer={
        <>
          {track && onDelete && (
            <Button variant="danger" className="mr-auto" onClick={() => onDelete(track)}>
              Slett
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Avbryt
          </Button>
          {!track && (
            <Button onClick={() => save(true)} disabled={saving}>
              Lagre og legg til ny
            </Button>
          )}
          <Button variant="primary" onClick={() => save()} disabled={saving}>
            Lagre <kbd className="hidden text-xs opacity-60 sm:inline">Ctrl+Enter</kbd>
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-6"
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
        {error && <p className="rounded-lg bg-red-900/50 px-3 py-2 text-sm text-red-200 sm:col-span-6">{error}</p>}

        <div className="flex gap-2 sm:col-span-6">
          {(['owned', 'wishlist'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set('status', s)}
              className={`min-h-11 flex-1 rounded-lg border text-sm font-medium ${d.status === s ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-panel2 text-slate-300'}`}
            >
              {s === 'owned' ? '✓ Jeg eier låten' : '☆ Ønskeliste'}
            </button>
          ))}
        </div>

        <Field label="Artist *" className="sm:col-span-3">
          <input data-autofocus autoFocus className="input" value={d.artist} onChange={(e) => set('artist', e.target.value)} />
        </Field>
        <Field label="Tittel *" className="sm:col-span-3">
          <input className="input" value={d.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        {dups.length > 0 && (
          <p className="rounded-lg bg-amber-900/40 px-3 py-2 text-sm text-amber-200 sm:col-span-6">
            ⚠ Ser ut som en duplikat av: {dups.map((x) => `${x.artist} – ${x.title}${x.version ? ` (${x.version})` : ''}`).join('; ')}
          </p>
        )}
        <Field label="Remix / versjon" className="sm:col-span-2">
          <input className="input" placeholder="Original Mix" value={d.version} onChange={(e) => set('version', e.target.value)} />
        </Field>
        <Field label="Label" className="sm:col-span-2">
          <input className="input" value={d.label} onChange={(e) => set('label', e.target.value)} />
        </Field>
        <Field label="År" className="sm:col-span-1">
          <NumberInput value={d.year} onChange={(v) => set('year', v == null ? null : Math.round(v))} />
        </Field>
        <Field label="Lengde" className="sm:col-span-1" hint="m:ss">
          <input className="input" inputMode="numeric" placeholder="6:30" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>

        <Field label="BPM" className="sm:col-span-2" hint={d.analysis?.bpm ? `Analyse foreslår ${d.analysis.bpm}` : undefined}>
          <NumberInput value={d.bpm} step="0.01" placeholder="128.00" onChange={(v) => set('bpm', v)} />
        </Field>
        <Field label="Key (Camelot ⇄ vanlig notasjon)" className="sm:col-span-4">
          <KeyInput value={d.camelot} onChange={(v) => set('camelot', v)} />
        </Field>

        <Field label={`Energi ${d.energy ?? '–'}/10`} className="sm:col-span-6">
          <EnergyPicker value={d.energy} onChange={(v) => set('energy', v)} />
        </Field>

        <Field label="Sjanger" className="sm:col-span-2">
          <SuggestInput value={d.genre} onChange={(v) => set('genre', v)} suggestions={suggestions.genres} />
        </Field>
        <Field label="Undersjanger" className="sm:col-span-2">
          <SuggestInput value={d.subgenre} onChange={(v) => set('subgenre', v)} suggestions={suggestions.subgenres} />
        </Field>
        <Field label="Stemning" className="sm:col-span-2">
          <SuggestInput value={d.mood} onChange={(v) => set('mood', v)} suggestions={suggestions.moods} placeholder="euforisk, mørk …" />
        </Field>

        <Field label="Tagger" className="sm:col-span-6">
          <TagInput value={d.tags} onChange={(v) => set('tags', v)} suggestions={suggestions.tags} />
        </Field>

        <Field label="Intro (takter)" className="sm:col-span-1">
          <NumberInput value={d.introBars} onChange={(v) => set('introBars', v)} placeholder="32" />
        </Field>
        <Field label="Outro (takter)" className="sm:col-span-1">
          <NumberInput value={d.outroBars} onChange={(v) => set('outroBars', v)} placeholder="32" />
        </Field>
        <Field label="Min vurdering" className="sm:col-span-2">
          <Stars value={d.rating} onChange={(v) => set('rating', v)} />
        </Field>
        <Field label="Antall ganger spilt" className="sm:col-span-1">
          <NumberInput value={d.playCount} onChange={(v) => set('playCount', Math.max(0, Math.round(v ?? 0)))} />
        </Field>
        <Field label="Spilt sist" className="sm:col-span-1">
          <input
            type="date"
            className="input"
            value={d.lastPlayedAt?.slice(0, 10) ?? ''}
            onChange={(e) => set('lastPlayedAt', e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </Field>

        <Field label="Notater" className="sm:col-span-6">
          <textarea className="input min-h-24" value={d.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Breakdown etter 3 min, fin å mikse ut av …" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
