import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowLeftRight, ArrowUp, CalendarDays, CheckCheck, ChevronRight, Download, FileSpreadsheet, GripVertical, Lock, LockOpen, MapPin, Plus, Redo2, Search, Settings2, Share, Sparkles, Undo2, Wand2, X } from 'lucide-react';
import { db } from '../../db/db';
import type { DjSet, SetSlot, Track } from '../../db/types';
import { markSetPlayed, pairKey, playSecFor, saveSet } from '../../db/sets';
import { updateTrack } from '../../db/tracks';
import { analyzeSet } from '../../engine/analysis';
import { buildSequences, type Lock as SeqLock, type SequenceResult } from '../../engine/sequencer';
import { CURVE_PRESETS } from '../../engine/energy';
import { CamelotWheel } from '../../components/CamelotWheel';
import { Button, EmptyState, EnergyBadge, EnergyPicker, Field, IconButton, KeyBadge, Modal, NumberInput, fmtDate } from '../../components/ui';
import { formatDuration } from '../../lib/normalize';
import { href } from '../../lib/router';
import { useLocalStorage } from '../../lib/useLocalStorage';
import { openTrack } from '../../lib/uiStore';
import { collectValues } from '../library/filter';
import { AlternativesDialog } from './AlternativesDialog';
import { BridgeDialog } from './BridgeDialog';
import { SwapDialog } from './SwapDialog';
import { CurveEditor } from './CurveEditor';
import { ExportDialog } from './ExportDialog';
import { GRADE_STYLE } from './grade';
import { SetChart } from './SetChart';
import { TrackPicker } from './TrackPicker';
import { ImportToSetDialog, type ImportToSetResult } from './ImportToSetDialog';
import { DropOverlay } from '../../components/DropOverlay';
import { useFileDrop } from '../../lib/useFileDrop';
import { SetLengthFields } from './SetLengthFields';
import { describeLength, estimateLength } from './setLength';
import { readPlaylistFile, type PlaylistFile } from '../../importers/playlistFile';

type Snapshot = Pick<DjSet, 'slots' | 'poolIds'>;

function Stat({ label, children, tone }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-[15px] tabular-nums ${tone ?? 'text-ink'}`}>{children}</span>
    </div>
  );
}

export function SetEditor({ setId }: { setId: string }) {
  const stored = useLiveQuery(() => db.sets.get(setId).then((s) => s ?? null), [setId]);
  const allTracks = useLiveQuery(() => db.tracks.toArray(), []);
  const [draft, setDraft] = useState<DjSet | null>(null);
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const [, force] = useState(0);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [altOpen, setAltOpen] = useState(false);
  const [alts, setAlts] = useState<SequenceResult[]>([]);
  const [computing, setComputing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [bridgeAt, setBridgeAt] = useState<number | null>(null);
  const [swapAt, setSwapAt] = useState<number | null>(null);
  const [energyFor, setEnergyFor] = useState<Track | null>(null);
  const [showSettings, setShowSettings] = useLocalStorage('set.showSettings.v2', false);
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [confirmPlayed, setConfirmPlayed] = useState(false);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [playlist, setPlaylist] = useState<PlaylistFile | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const dragging = useFileDrop((f) => void readPlaylistFile(f).then(setPlaylist), !!draft);

  // Last settet inn én gang; deretter er det lokale utkastet fasit (lagres fortløpende)
  useEffect(() => {
    if (stored && (!draft || draft.id !== stored.id)) {
      setDraft(stored);
      past.current = [];
      future.current = [];
    }
  }, [stored, draft]);

  const byId = useMemo(() => new Map((allTracks ?? []).map((t) => [t.id, t])), [allTracks]);

  const update = useCallback((fn: (s: DjSet) => DjSet, history = false) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      if (history) {
        past.current.push({ slots: prev.slots, poolIds: prev.poolIds });
        if (past.current.length > 100) past.current.shift();
        future.current = [];
      }
      saveSet(next);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    const snap = past.current.pop();
    if (!snap) return;
    setDraft((prev) => {
      if (!prev) return prev;
      future.current.push({ slots: prev.slots, poolIds: prev.poolIds });
      const next = { ...prev, ...snap };
      saveSet(next);
      return next;
    });
    force((n) => n + 1);
  }, []);
  const redo = useCallback(() => {
    const snap = future.current.pop();
    if (!snap) return;
    setDraft((prev) => {
      if (!prev) return prev;
      past.current.push({ slots: prev.slots, poolIds: prev.poolIds });
      const next = { ...prev, ...snap };
      saveSet(next);
      return next;
    });
    force((n) => n + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!draft) return;
      const el = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || document.querySelector('[role=dialog]')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (!mod && !e.altKey && e.key === 'a') setPickerOpen(true);
      else if (!mod && !e.altKey && e.key === 'b') build();
      else if (!mod && !e.altKey && e.key === 'e') setExportOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const slotTracks = useMemo(() => (draft ? draft.slots.map((s) => byId.get(s.trackId)).filter((t): t is Track => !!t) : []), [draft, byId]);
  const playSec = useMemo(() => (draft ? playSecFor(draft) : () => 330), [draft]);
  const analysis = useMemo(
    () =>
      draft
        ? analyzeSet(slotTracks, {
            curve: draft.curve,
            playSec,
            artistGap: draft.artistGap,
            maxTempoPct: draft.maxTempoPct,
            playedInfo: (t) => ({ lastPlayedAt: t.lastPlayedAt, playCount: t.playCount }),
          })
        : null,
    [draft, slotTracks, playSec],
  );

  if (stored === null)
    return (
      <EmptyState title="Set not found" actions={<a href={href({ name: 'sets' })} className="text-accent hover:underline">Back to sets</a>}>
        It may have been deleted, or it lives in another browser.
      </EmptyState>
    );
  if (!draft || !allTracks || !analysis) return null;

  const set = draft;
  const inSet = new Set(set.slots.map((s) => s.trackId));
  const poolOnly = set.poolIds.map((id) => byId.get(id)).filter((t): t is Track => !!t && !inSet.has(t.id));
  const poolTracks = set.poolIds.map((id) => byId.get(id)).filter((t): t is Track => !!t);
  const targetSec = set.targetMinutes ? set.targetMinutes * 60 : null;
  const toGet = slotTracks.filter((t) => t.status === 'wishlist').length;
  const firstIndexByDup = new Map<string, number>();
  const dupWarnings = new Map<number, string>();
  slotTracks.forEach((t, i) => {
    const first = firstIndexByDup.get(t.dupKey);
    if (first === undefined) firstIndexByDup.set(t.dupKey, i);
    else dupWarnings.set(i, `same track as #${first + 1}`);
  });
  const warningsAt = (i: number) => [...analysis.warnings.filter((w) => w.index === i).map((w) => w.message), ...(dupWarnings.has(i) ? [dupWarnings.get(i)!] : [])];
  const values = collectValues(allTracks);

  // Samme låt (artist+tittel+versjon) skal bare være med én gang: behold den som er i settet/eies
  const seenDup = new Set<string>();
  const buildPool = Array.from(new Set([...set.slots.map((s) => s.trackId), ...set.poolIds]))
    .map((id) => byId.get(id))
    .filter((t): t is Track => !!t)
    .sort((a, b) => Number(inSet.has(b.id)) - Number(inSet.has(a.id)) || Number(b.status === 'owned') - Number(a.status === 'owned'))
    .filter((t) => (seenDup.has(t.dupKey) ? false : (seenDup.add(t.dupKey), true)));
  const poolDurations = buildPool.map((t) => t.durationSec);

  /** Bygg rekkefølger. `over` brukes når en innstilling endres og vi bygger på nytt med en gang. */
  function build(over: Partial<DjSet> = {}) {
    const cfg = { ...set, ...over };
    const pool = buildPool;
    if (!pool.length) {
      setPickerOpen(true);
      return;
    }
    const locks: SeqLock[] = set.slots.flatMap((s, i): SeqLock[] => (s.locked ? [{ trackId: s.trackId, position: i === 0 ? 'first' : i === set.slots.length - 1 ? 'last' : i }] : []));
    setAltOpen(true);
    setComputing(true);
    setTimeout(() => {
      const res = buildSequences(pool, { curve: cfg.curve, targetSec: cfg.targetMinutes ? cfg.targetMinutes * 60 : null, locks, alternatives: 3, artistGap: cfg.artistGap, playSec: playSecFor(cfg), maxTempoPct: cfg.maxTempoPct });
      setAlts(res);
      setComputing(false);
    }, 30);
  }

  const lockedIds = new Set(set.slots.filter((s) => s.locked).map((s) => s.trackId));
  const applyOrder = (order: string[]) =>
    update((s) => ({ ...s, slots: order.map((trackId) => ({ trackId, locked: lockedIds.has(trackId) })), poolIds: Array.from(new Set([...s.poolIds, ...order])) }), true);

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= set.slots.length) return;
    update((s) => {
      const slots = [...s.slots];
      const [x] = slots.splice(from, 1);
      slots.splice(to, 0, x);
      return { ...s, slots };
    }, true);
  };
  const removeAt = (i: number) => update((s) => ({ ...s, slots: s.slots.filter((_, k) => k !== i) }), true);
  // Bytt låten på plass i; den gamle blir liggende i reserven
  const replaceAt = (i: number, id: string) =>
    update((s) => {
      const old = s.slots[i];
      if (!old) return s;
      const slots = s.slots.map((x, k) => (k === i ? { trackId: id, locked: x.locked } : x));
      return { ...s, slots, poolIds: Array.from(new Set([...s.poolIds, old.trackId, id])) };
    }, true);
  const toggleLock = (i: number) => update((s) => ({ ...s, slots: s.slots.map((x, k) => (k === i ? { ...x, locked: !x.locked } : x)) }), true);
  const append = (id: string) => update((s) => ({ ...s, slots: [...s.slots, { trackId: id, locked: false }] }), true);
  const insertAt = (i: number, id: string) =>
    update((s) => {
      const slots: SetSlot[] = [...s.slots];
      slots.splice(i, 0, { trackId: id, locked: false });
      return { ...s, slots, poolIds: s.poolIds.includes(id) ? s.poolIds : [...s.poolIds, id] };
    }, true);
  const removeFromPool = (id: string) => update((s) => ({ ...s, poolIds: s.poolIds.filter((x) => x !== id) }), true);
  const scrollTo = (i: number) => rowRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Spilleliste fra Exportify: i potten, eller bakerst i settet i spillelistens rekkefølge
  const addPlaylist = ({ ids, mode }: ImportToSetResult) =>
    update((s) => {
      const inSlots = new Set(s.slots.map((x) => x.trackId));
      return {
        ...s,
        poolIds: Array.from(new Set([...s.poolIds, ...ids])),
        slots: mode === 'order' ? [...s.slots, ...ids.filter((id) => !inSlots.has(id)).map((trackId) => ({ trackId, locked: false }))] : s.slots,
      };
    }, true);


  return (
    <div className="flex flex-col gap-6">
      {/* Topp */}
      <div className="flex flex-col gap-3">
        <nav className="flex items-center gap-1 text-[13px] text-muted">
          <a href={href({ name: 'sets' })} className="hover:text-ink">
            Sets
          </a>
          <ChevronRight size={14} />
        </nav>
        <input
          className="serif -mx-2 w-full rounded-xl border border-transparent bg-transparent px-2 py-1 text-[28px] leading-tight text-ink transition hover:border-line focus:border-[#5c5752] focus:outline-none sm:text-[34px]"
          value={set.name}
          onChange={(e) => update((s) => ({ ...s, name: e.target.value }))}
          aria-label="Set name"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-line px-3 text-sm text-ink2 focus-within:border-[#5c5752]">
            <CalendarDays size={15} className="text-muted" />
            <input type="date" className="min-h-10 bg-transparent focus:outline-none" value={set.date ?? ''} onChange={(e) => update((s) => ({ ...s, date: e.target.value || null }))} aria-label="Date" />
          </label>
          <label className="flex min-w-0 flex-1 basis-48 items-center gap-2 rounded-xl border border-line px-3 text-sm text-ink2 focus-within:border-[#5c5752] sm:max-w-xs">
            <MapPin size={15} className="text-muted" />
            <input className="min-h-10 w-full bg-transparent placeholder:text-muted focus:outline-none" placeholder="Venue / event" value={set.venue} onChange={(e) => update((s) => ({ ...s, venue: e.target.value }))} aria-label="Venue" />
          </label>
        </div>
      </div>

      <div className="card flex flex-wrap gap-x-8 gap-y-3 px-5 py-4">
        <Stat label="Tracks">
          {slotTracks.length}
          {poolOnly.length > 0 && <span className="text-sm text-muted"> + {poolOnly.length} in reserve</span>}
        </Stat>
        <Stat label="Length">
          {formatDuration(analysis.totalSec)}
          {targetSec ? <span className="text-sm text-muted"> / {formatDuration(targetSec)}</span> : null}
        </Stat>
        {analysis.transitions.length > 0 && <Stat label="Average flow">{analysis.avgScore}</Stat>}
        {analysis.gaps.length > 0 && (
          <Stat label="Gaps" tone="text-[#f07a7a]">
            ! {analysis.gaps.length}
          </Stat>
        )}
        {toGet > 0 && (
          <button type="button" onClick={() => setExportOpen(true)} className="text-left">
            <Stat label="To get" tone="text-accent">
              <Download size={14} className="mr-1 inline" />
              {toGet}
            </Stat>
          </button>
        )}
        {set.playedAt && <Stat label="Played">{fmtDate(set.playedAt)}</Stat>}
      </div>

      {/* Verktøylinje */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => build()}>
          <Wand2 size={16} /> Build order
        </Button>
        <Button onClick={() => setPickerOpen(true)}>
          <Plus size={16} /> Add tracks
        </Button>
        <Button onClick={() => csvRef.current?.click()} title="Add a Spotify playlist exported from Exportify (or drag the file here)">
          <FileSpreadsheet size={16} /> Import CSV
        </Button>
        <Button onClick={() => setExportOpen(true)} disabled={!slotTracks.length}>
          <Share size={16} /> Export
        </Button>
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <IconButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!past.current.length}>
          <Undo2 size={18} />
        </IconButton>
        <IconButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!future.current.length}>
          <Redo2 size={18} />
        </IconButton>
        <IconButton label="Set settings" active={showSettings} onClick={() => setShowSettings(!showSettings)}>
          <Settings2 size={18} />
        </IconButton>
        <Button variant="ghost" className="ml-auto" onClick={() => setConfirmPlayed(true)} disabled={!slotTracks.length}>
          <CheckCheck size={16} /> Mark as played
        </Button>
      </div>

      {!showSettings && (
        <button type="button" onClick={() => setShowSettings(true)} className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 self-start rounded-lg px-1 text-[13px] text-muted transition hover:text-ink">
          <Settings2 size={14} />
          <span className="text-ink2">{set.targetMinutes ? `${set.targetMinutes} min set` : 'No length limit'}</span>·<span>{set.curve.preset === 'custom' ? 'Custom curve' : CURVE_PRESETS[set.curve.preset].label}</span>·
          <span>{set.playMode === 'full' ? 'Whole tracks' : `${set.fixedMinutes} min per track`}</span>·<span className="underline-offset-2 hover:underline">Edit</span>
        </button>
      )}

      {showSettings && (
        <div className="card grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <SetLengthFields value={set} onChange={({ targetMinutes, playMode, fixedMinutes }) => update((s) => ({ ...s, targetMinutes, playMode, fixedMinutes }))} durations={poolDurations} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Max tempo change" hint="per transition, in %">
                <NumberInput className="w-24" value={set.maxTempoPct} onChange={(v) => v && v > 0 && update((s) => ({ ...s, maxTempoPct: v }))} />
              </Field>
              <Field label="Same artist" hint="at least this many tracks apart">
                <NumberInput className="w-24" value={set.artistGap} onChange={(v) => v != null && v >= 0 && update((s) => ({ ...s, artistGap: Math.round(v) }))} />
              </Field>
            </div>
            <Field label="Notes">
              <textarea className="input min-h-16" value={set.notes} onChange={(e) => update((s) => ({ ...s, notes: e.target.value }))} placeholder="Crowd, sound system, who plays before and after…" />
            </Field>
          </div>
          <Field label="Energy curve" group>
            <CurveEditor curve={set.curve} onChange={(curve) => update((s) => ({ ...s, curve }))} />
          </Field>
        </div>
      )}

      {!poolTracks.length && !slotTracks.length ? (
        <EmptyState
          icon={<Sparkles size={28} />}
          title="Start with a pool of tracks"
          actions={
            <>
              <Button variant="primary" onClick={() => setPickerOpen(true)}>
                <Plus size={16} /> Add tracks
              </Button>
              <Button onClick={() => csvRef.current?.click()}>
                <FileSpreadsheet size={16} /> Import Exportify CSV
              </Button>
            </>
          }
        >
          Add the tracks you’re considering — say, all your trance between 132 and 140 BPM — or drag a Spotify playlist exported from Exportify (CSV) right here. Then press “Build order” to get three options.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {/* Settet */}
          <div className="flex min-w-0 flex-col gap-3">
            {!slotTracks.length && (
              <EmptyState
                title={`${buildPool.length} track${buildPool.length === 1 ? '' : 's'} in the pool`}
                actions={
                  <>
                    <Button variant="primary" onClick={() => build()}>
                      <Wand2 size={16} /> Build order
                    </Button>
                    <Button onClick={() => applyOrder(poolTracks.map((t) => t.id))}>Add all as they are</Button>
                  </>
                }
              >
                No order yet. Let the engine suggest one, or add them in the current order and arrange them yourself.
                <span className="mt-3 flex flex-col items-center gap-1 rounded-xl bg-sidebar/70 px-4 py-3 text-[13px] text-ink2">
                  {describeLength(estimateLength(poolDurations, set), set)}
                  <button type="button" onClick={() => setShowSettings(true)} className="text-accent hover:underline">
                    Change set length
                  </button>
                </span>
              </EmptyState>
            )}
            <ol className="flex flex-col">
              {slotTracks.map((t, i) => {
                const slot = set.slots[i];
                const item = analysis.items[i];
                const tr = analysis.transitions[i];
                const next = slotTracks[i + 1];
                const gap = analysis.gaps.find((g) => g.index === i);
                const g = tr ? GRADE_STYLE[tr.grade] : null;
                const noteKey = next ? pairKey(t.id, next.id) : '';
                const isPeak = analysis.peakIndex === i;
                const warnings = warningsAt(i);
                return (
                  <li
                    key={`${t.id}-${i}`}
                    ref={(el) => (rowRefs.current[i] = el)}
                    onDragOver={(e) => {
                      if (dragFrom == null) return;
                      e.preventDefault();
                      setDragOver(i);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragFrom != null) move(dragFrom, i);
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                  >
                    <div
                      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border bg-surface px-2 py-2 transition sm:flex-nowrap ${dragOver === i && dragFrom !== i ? 'border-accent' : slot.locked ? 'border-[#5c5752]' : 'border-line'} ${dragFrom === i ? 'opacity-40' : ''}`}
                      draggable
                      onDragStart={(e) => {
                        setDragFrom(i);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDragFrom(null);
                        setDragOver(null);
                      }}
                    >
                      <span className="hidden cursor-grab text-[#4a4642] sm:block" title="Drag to move">
                        <GripVertical size={16} />
                      </span>
                      <div className="flex w-11 shrink-0 flex-col items-center">
                        <span className="text-[15px] font-medium tabular-nums">{i + 1}</span>
                        <span className="text-[11px] tabular-nums text-muted">{formatDuration(item.startSec)}</span>
                      </div>
                      <button type="button" className="min-w-0 flex-1 py-1 text-left" onClick={() => openTrack(t)} title="Edit track">
                        <div className="truncate text-[15px]">
                          {t.title}
                          {t.version && <span className="text-muted"> · {t.version}</span>}
                        </div>
                        <div className="truncate text-[13px] text-muted">{t.artist}</div>
                        {(t.status === 'wishlist' || isPeak || warnings.length > 0) && (
                          <div className="mt-0.5 flex flex-wrap gap-x-2.5 text-[12px]">
                            {t.status === 'wishlist' && (
                              <span className="text-accent">
                                <Download size={11} className="mr-0.5 inline" />
                                to get
                              </span>
                            )}
                            {isPeak && <span className="text-ink2">▲ peak of the set</span>}
                            {warnings.map((w) => (
                              <span key={w} className="text-ok">
                                ⚠ {w}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                      <span className="w-11 text-right text-sm tabular-nums text-ink2">{t.bpm != null ? t.bpm.toFixed(t.bpm % 1 ? 1 : 0) : '–'}</span>
                      <KeyBadge camelot={t.camelot} showMusical={false} />
                      <button type="button" onClick={() => setEnergyFor(t)} title={`Energy ${t.energy ?? 'not set'} — target here: ${Math.round(item.targetEnergy)}. Click to change.`} className="flex flex-col items-center gap-0.5 rounded-lg p-1 hover:bg-raised">
                        <EnergyBadge value={t.energy} />
                        <span className="text-[10px] tabular-nums text-muted">→ {Math.round(item.targetEnergy)}</span>
                      </button>
                      <div className="flex w-full shrink-0 justify-end border-t border-line/60 pt-1 sm:w-auto sm:border-0 sm:pt-0">
                        <IconButton label={slot.locked ? 'Locked — keeps its place when you rebuild' : 'Lock to this position'} active={slot.locked} onClick={() => toggleLock(i)}>
                          {slot.locked ? <Lock size={16} /> : <LockOpen size={16} />}
                        </IconButton>
                        <IconButton label="Move up" onClick={() => move(i, i - 1)} disabled={i === 0}>
                          <ArrowUp size={16} />
                        </IconButton>
                        <IconButton label="Move down" onClick={() => move(i, i + 1)} disabled={i === slotTracks.length - 1}>
                          <ArrowDown size={16} />
                        </IconButton>
                        <IconButton label="Swap for another track" onClick={() => setSwapAt(i)}>
                          <ArrowLeftRight size={16} />
                        </IconButton>
                        <IconButton label="Remove from set (stays in reserve)" onClick={() => removeAt(i)} className="hover:!text-[#f07a7a]">
                          <X size={16} />
                        </IconButton>
                      </div>
                    </div>

                    {tr && g && (
                      <div className="ml-6 flex gap-3 py-1.5 sm:ml-12">
                        <span className={`w-0.5 shrink-0 rounded-full ${g.bar}`} />
                        <div className="flex min-w-0 flex-1 flex-col gap-1 py-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                            <span className={`font-medium ${g.text}`}>
                              {g.icon} {g.word} · {tr.score}
                            </span>
                            <span className="text-ink2">{tr.explanation}</span>
                            {(gap || tr.grade !== 'good') && (
                              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setBridgeAt(i)}>
                                <Search size={14} /> Find bridge track
                              </Button>
                            )}
                          </div>
                          {gap && gap.reasons.length > 0 && <div className="text-xs text-[#f07a7a]">Gap: {gap.reasons.join(', ')}</div>}
                          {set.transitionNotes[noteKey] || noteOpen === noteKey ? (
                            <input
                              autoFocus={noteOpen === noteKey && !set.transitionNotes[noteKey]}
                              className="-mx-2 w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-[13px] text-ink placeholder:text-[#5c5752] hover:border-line focus:border-[#5c5752] focus:outline-none"
                              placeholder="e.g. “filter out the bass over 16 bars”"
                              aria-label="Transition note"
                              value={set.transitionNotes[noteKey] ?? ''}
                              onBlur={() => setNoteOpen(null)}
                              onChange={(e) => {
                                const v = e.target.value;
                                update((s) => {
                                  const notes = { ...s.transitionNotes };
                                  if (v) notes[noteKey] = v;
                                  else delete notes[noteKey];
                                  return { ...s, transitionNotes: notes };
                                });
                              }}
                            />
                          ) : (
                            <button type="button" onClick={() => setNoteOpen(noteKey)} className="self-start text-[12px] text-[#5c5752] transition hover:text-ink2">
                              + Note
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            {poolOnly.length > 0 && (
              <details className="card px-4 py-3">
                <summary className="cursor-pointer text-sm text-ink2">Reserve — in the pool but not in the set ({poolOnly.length})</summary>
                <ul className="mt-2 flex flex-col">
                  {[...poolOnly]
                    .sort((a, b) => (a.bpm ?? 0) - (b.bpm ?? 0))
                    .map((t) => (
                      <li key={t.id} className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-raised/60">
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {t.artist} – {t.title}
                          {t.status === 'wishlist' && <Download size={12} className="ml-1 inline text-accent" />}
                        </span>
                        <span className="w-10 text-right text-sm tabular-nums text-ink2">{t.bpm ? Math.round(t.bpm) : '–'}</span>
                        <KeyBadge camelot={t.camelot} showMusical={false} />
                        <EnergyBadge value={t.energy} />
                        <IconButton label="Add to the end of the set" onClick={() => append(t.id)}>
                          <Plus size={16} />
                        </IconButton>
                        <IconButton label="Remove from pool" onClick={() => removeFromPool(t.id)}>
                          <X size={16} />
                        </IconButton>
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </div>

          {/* Visualisering */}
          {slotTracks.length > 0 && (
            <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
              <div className="card p-4">
                <h3 className="mb-2 text-sm font-medium">The set over time</h3>
                <SetChart analysis={analysis} curve={set.curve} onSelect={scrollTo} />
              </div>
              <div className="card flex flex-col items-center p-4">
                <h3 className="mb-2 self-start text-sm font-medium">Journey around the Camelot wheel</h3>
                <CamelotWheel tracks={slotTracks} size={280} />
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={csvRef}
        type="file"
        accept=".csv,.tsv,.txt,text/csv"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) setPlaylist(await readPlaylistFile(f));
        }}
      />
      <DropOverlay show={dragging} title="Drop to add to this set" text="An Exportify CSV (or a .txt list). Tracks already in your library are reused." />
      <ImportToSetDialog file={playlist} forNewSet={false} onClose={() => setPlaylist(null)} onConfirm={addPlaylist} />
      <TrackPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        tracks={allTracks}
        already={new Set([...set.poolIds, ...inSet])}
        genres={values.genres}
        setTracks={buildPool}
        setName={set.name}
        maxTempoPct={set.maxTempoPct}
        onAdd={(ids) => update((s) => ({ ...s, poolIds: Array.from(new Set([...s.poolIds, ...ids])) }), true)}
      />
      <AlternativesDialog
        open={altOpen}
        onClose={() => setAltOpen(false)}
        results={alts}
        byId={byId}
        computing={computing}
        targetSec={targetSec}
        poolSize={buildPool.length}
        onUseAll={() => {
          update((s) => ({ ...s, targetMinutes: null }));
          build({ targetMinutes: null });
        }}
        onChangeLength={() => {
          setAltOpen(false);
          setShowSettings(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onPick={(r) => {
          applyOrder(r.order);
          setAltOpen(false);
        }}
      />
      <SwapDialog
        open={swapAt != null}
        onClose={() => setSwapAt(null)}
        index={swapAt}
        order={slotTracks}
        library={allTracks}
        poolIds={set.poolIds}
        targetEnergy={swapAt != null ? (analysis.items[swapAt]?.targetEnergy ?? null) : null}
        maxTempoPct={set.maxTempoPct}
        onSwap={(id) => {
          if (swapAt != null) replaceAt(swapAt, id);
          setSwapAt(null);
        }}
        onRemove={() => {
          if (swapAt != null) removeAt(swapAt);
          setSwapAt(null);
        }}
      />
      <BridgeDialog
        open={bridgeAt != null}
        onClose={() => setBridgeAt(null)}
        from={bridgeAt != null ? slotTracks[bridgeAt] : null}
        to={bridgeAt != null ? slotTracks[bridgeAt + 1] : null}
        library={allTracks}
        inSet={inSet}
        maxTempoPct={set.maxTempoPct}
        onInsert={(t) => {
          if (bridgeAt != null) insertAt(bridgeAt + 1, t.id);
          setBridgeAt(null);
        }}
      />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} set={set} tracks={slotTracks} analysis={analysis} />
      <Modal open={!!energyFor} onClose={() => setEnergyFor(null)} title="Energy level">
        {energyFor && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink2">
              {energyFor.artist} – {energyFor.title}
            </p>
            <EnergyPicker
              value={energyFor.energy}
              onChange={async (v) => {
                await updateTrack(energyFor.id, { energy: v, sources: { ...energyFor.sources, energy: 'manual' } });
                setEnergyFor(null);
              }}
            />
            <p className="text-xs text-muted">1–3 warm-up · 4–6 groove · 7–8 driving · 9–10 peak</p>
          </div>
        )}
      </Modal>
      <Modal
        open={confirmPlayed}
        onClose={() => setConfirmPlayed(false)}
        title="Mark the set as played?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmPlayed(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                const when = set.date ? new Date(`${set.date}T22:00:00`) : new Date();
                await markSetPlayed(set.id, when);
                setDraft((d) => (d ? { ...d, playedAt: when.toISOString() } : d));
                setConfirmPlayed(false);
              }}
            >
              Mark as played
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink2">
          All {slotTracks.length} tracks get +1 to “times played”, and “last played” is set to {set.date ? fmtDate(`${set.date}T00:00:00`) : 'today'}. You’ll then be warned if you play them again too soon.
        </p>
      </Modal>
    </div>
  );
}
