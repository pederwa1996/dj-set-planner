import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { DjSet, SetSlot, Track } from '../../db/types';
import { markSetPlayed, pairKey, playSecFor, saveSet } from '../../db/sets';
import { updateTrack } from '../../db/tracks';
import { analyzeSet } from '../../engine/analysis';
import { buildSequences, type Lock, type SequenceResult } from '../../engine/sequencer';
import { Button, EnergyBadge, EnergyPicker, Field, KeyBadge, Modal, NumberInput } from '../../components/ui';
import { formatDuration, makeDupKey } from '../../lib/normalize';
import { useLocalStorage } from '../../lib/useLocalStorage';
import { collectValues } from '../library/filter';
import { TrackEditor } from '../library/TrackEditor';
import { AlternativesDialog } from './AlternativesDialog';
import { BridgeDialog } from './BridgeDialog';
import { CamelotWheel } from './CamelotWheel';
import { CurveEditor } from './CurveEditor';
import { ExportDialog } from './ExportDialog';
import { GRADE_STYLE } from './grade';
import { SetChart } from './SetChart';
import { TrackPicker } from './TrackPicker';

type Snapshot = Pick<DjSet, 'slots' | 'poolIds'>;

export function SetEditor({ setId, onBack }: { setId: string; onBack: () => void }) {
  const stored = useLiveQuery(() => db.sets.get(setId), [setId]);
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
  const [editTrack, setEditTrack] = useState<Track | null>(null);
  const [energyFor, setEnergyFor] = useState<Track | null>(null);
  const [showSettings, setShowSettings] = useLocalStorage('set.showSettings', true);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [confirmPlayed, setConfirmPlayed] = useState(false);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);

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

  if (!draft || !allTracks || !analysis) return <p className="p-6 text-muted">Laster set …</p>;

  const set = draft;
  const inSet = new Set(set.slots.map((s) => s.trackId));
  const poolOnly = set.poolIds.map((id) => byId.get(id)).filter((t): t is Track => !!t && !inSet.has(t.id));
  const poolTracks = set.poolIds.map((id) => byId.get(id)).filter((t): t is Track => !!t);
  const targetSec = set.targetMinutes ? set.targetMinutes * 60 : null;
  const toBuy = slotTracks.filter((t) => t.status === 'wishlist').length;
  const firstIndexByDup = new Map<string, number>();
  const dupWarnings = new Map<number, string>();
  slotTracks.forEach((t, i) => {
    const first = firstIndexByDup.get(t.dupKey);
    if (first === undefined) firstIndexByDup.set(t.dupKey, i);
    else dupWarnings.set(i, `samme låt som nr. ${first + 1}`);
  });
  const warningsAt = (i: number) => [...analysis.warnings.filter((w) => w.index === i), ...(dupWarnings.has(i) ? [{ index: i, kind: 'dup', message: dupWarnings.get(i)! }] : [])];
  const values = collectValues(allTracks);

  function build() {
    // Samme låt (artist+tittel+versjon) skal bare være med én gang: behold den som er i settet/eies
    const candidates = Array.from(new Set([...set.slots.map((s) => s.trackId), ...set.poolIds]))
      .map((id) => byId.get(id))
      .filter((t): t is Track => !!t)
      .sort((a, b) => Number(inSet.has(b.id)) - Number(inSet.has(a.id)) || Number(b.status === 'owned') - Number(a.status === 'owned'));
    const seenDup = new Set<string>();
    const pool = candidates.filter((t) => (seenDup.has(t.dupKey) ? false : (seenDup.add(t.dupKey), true)));
    if (!pool.length) {
      setPickerOpen(true);
      return;
    }
    const locks: Lock[] = set.slots.flatMap((s, i): Lock[] => (s.locked ? [{ trackId: s.trackId, position: i === 0 ? 'first' : i === set.slots.length - 1 ? 'last' : i }] : []));
    setAltOpen(true);
    setComputing(true);
    setTimeout(() => {
      const res = buildSequences(pool, { curve: set.curve, targetSec, locks, alternatives: 3, artistGap: set.artistGap, playSec, maxTempoPct: set.maxTempoPct });
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

  const byDupKey = new Map<string, Track[]>();
  allTracks.forEach((t) => byDupKey.set(t.dupKey, [...(byDupKey.get(t.dupKey) ?? []), t]));

  return (
    <div className="flex flex-col gap-4">
      {/* Topp: navn og nøkkeltall */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onBack}>
          ← Sets
        </Button>
        <input className="input min-w-0 flex-1 basis-48 text-lg font-semibold" value={set.name} onChange={(e) => update((s) => ({ ...s, name: e.target.value }))} aria-label="Navn på settet" />
        <input type="date" className="input w-40" value={set.date ?? ''} onChange={(e) => update((s) => ({ ...s, date: e.target.value || null }))} aria-label="Dato" />
        <input className="input w-44" placeholder="Sted / arrangement" value={set.venue} onChange={(e) => update((s) => ({ ...s, venue: e.target.value }))} />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
        <span>
          <strong className="text-slate-100">{slotTracks.length}</strong> låter i settet · {poolOnly.length} i reserve
        </span>
        <span>
          Lengde <strong className="text-slate-100">{formatDuration(analysis.totalSec)}</strong>
          {targetSec ? ` / ${formatDuration(targetSec)}` : ''}
        </span>
        {analysis.transitions.length > 0 && (
          <span>
            Snittscore <strong className="text-slate-100">{analysis.avgScore}</strong>
          </span>
        )}
        {analysis.gaps.length > 0 && <span className="text-red-300">! {analysis.gaps.length} hull</span>}
        {toBuy > 0 && (
          <button type="button" className="text-amber-300 hover:underline" onClick={() => setExportOpen(true)}>
            ⬇ {toBuy} må skaffes
          </button>
        )}
        {set.playedAt && <span>Spilt {new Date(set.playedAt).toLocaleDateString('no')}</span>}
      </div>

      {/* Verktøylinje */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setPickerOpen(true)}>
          ＋ Legg til låter <kbd className="hidden text-xs opacity-50 lg:inline">A</kbd>
        </Button>
        <Button variant="primary" onClick={build}>
          ⚡ Bygg rekkefølge <kbd className="hidden text-xs opacity-60 lg:inline">B</kbd>
        </Button>
        <Button onClick={undo} disabled={!past.current.length} title="Angre (Ctrl+Z)">
          ↶ Angre
        </Button>
        <Button onClick={redo} disabled={!future.current.length} title="Gjør om (Ctrl+Shift+Z)">
          ↷ Gjør om
        </Button>
        <Button onClick={() => setExportOpen(true)} disabled={!slotTracks.length}>
          ⇩ Eksport <kbd className="hidden text-xs opacity-50 lg:inline">E</kbd>
        </Button>
        <Button onClick={() => setShowSettings(!showSettings)}>{showSettings ? 'Skjul innstillinger' : '⚙ Innstillinger for settet'}</Button>
        <Button variant="ghost" onClick={() => setConfirmPlayed(true)} disabled={!slotTracks.length}>
          ✓ Marker som spilt
        </Button>
      </div>

      {showSettings && (
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-panel p-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Field label="Ønsket lengde" group>
              <div className="flex flex-wrap items-center gap-2">
                {[45, 60, 90, 120].map((m) => (
                  <button key={m} type="button" onClick={() => update((s) => ({ ...s, targetMinutes: m }))} className={`min-h-11 rounded-lg border px-3 text-sm ${set.targetMinutes === m ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-panel2'}`}>
                    {m} min
                  </button>
                ))}
                <NumberInput className="w-24" placeholder="min" value={set.targetMinutes} onChange={(v) => update((s) => ({ ...s, targetMinutes: v && v > 0 ? v : null }))} />
                <button type="button" onClick={() => update((s) => ({ ...s, targetMinutes: null }))} className={`min-h-11 rounded-lg border px-3 text-sm ${set.targetMinutes == null ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-panel2'}`}>
                  Bruk alle låtene
                </button>
              </div>
            </Field>
            <Field label="Spilletid per låt" hint={set.playMode === 'full' ? 'Lengden på låten minus ca. 45 sekunder miksing. Låter uten lengde regnes som 5:30.' : 'Brukes når du bare spiller deler av hver låt.'} group>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => update((s) => ({ ...s, playMode: 'full' }))} className={`min-h-11 rounded-lg border px-3 text-sm ${set.playMode === 'full' ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-panel2'}`}>
                  Hele låten
                </button>
                <button type="button" onClick={() => update((s) => ({ ...s, playMode: 'fixed' }))} className={`min-h-11 rounded-lg border px-3 text-sm ${set.playMode === 'fixed' ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-panel2'}`}>
                  Fast tid
                </button>
                {set.playMode === 'fixed' && (
                  <>
                    <NumberInput className="w-20" value={set.fixedMinutes} onChange={(v) => v && v > 0 && update((s) => ({ ...s, fixedMinutes: v }))} />
                    <span className="text-muted">min</span>
                  </>
                )}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Maks tempoendring" hint="per overgang">
                <div className="flex items-center gap-2">
                  <NumberInput className="w-20" value={set.maxTempoPct} onChange={(v) => v && v > 0 && update((s) => ({ ...s, maxTempoPct: v }))} />
                  <span className="text-muted">%</span>
                </div>
              </Field>
              <Field label="Samme artist" hint="minst så mange låter imellom">
                <NumberInput className="w-20" value={set.artistGap} onChange={(v) => v != null && v >= 0 && update((s) => ({ ...s, artistGap: Math.round(v) }))} />
              </Field>
            </div>
            <Field label="Notater for settet">
              <textarea className="input min-h-16" value={set.notes} onChange={(e) => update((s) => ({ ...s, notes: e.target.value }))} placeholder="Publikum, lyd, hvem spiller før/etter …" />
            </Field>
          </div>
          <Field label="Energikurve" group>
            <CurveEditor curve={set.curve} onChange={(curve) => update((s) => ({ ...s, curve }))} />
          </Field>
        </div>
      )}

      {!poolTracks.length && !slotTracks.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-14 text-center">
          <p className="text-lg">Settet er tomt.</p>
          <p className="max-w-md text-muted">Legg låter i potten — f.eks. alle trance-låtene dine mellom 132 og 140 BPM — og trykk «Bygg rekkefølge». Motoren lager tre forslag du kan velge mellom.</p>
          <Button variant="primary" onClick={() => setPickerOpen(true)}>
            ＋ Legg til låter
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {/* Settet */}
          <div className="flex min-w-0 flex-col gap-2">
            {!slotTracks.length && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-10 text-center">
                <p>{poolTracks.length} låter i potten, men ingen rekkefølge ennå.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" onClick={build}>
                    ⚡ Bygg rekkefølge
                  </Button>
                  <Button onClick={() => applyOrder(poolTracks.map((t) => t.id))}>Legg alle inn i settet uten sortering</Button>
                </div>
              </div>
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
                      className={`flex flex-wrap items-center gap-2 rounded-xl border bg-panel p-2 sm:flex-nowrap ${dragOver === i && dragFrom !== i ? 'border-accent' : slot.locked ? 'border-sky-700' : 'border-line'} ${dragFrom === i ? 'opacity-40' : ''}`}
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
                      <span className="hidden cursor-grab select-none px-1 text-muted sm:inline" title="Dra for å flytte">
                        ⋮⋮
                      </span>
                      <div className="flex w-12 shrink-0 flex-col items-center text-xs">
                        <span className="text-base font-bold tabular-nums">{i + 1}</span>
                        <span className="tabular-nums text-muted">{formatDuration(item.startSec)}</span>
                      </div>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditTrack(t)} title="Rediger låt">
                        <div className="truncate font-medium">
                          {t.title}
                          {t.version && <span className="text-slate-400"> ({t.version})</span>}
                        </div>
                        <div className="truncate text-sm text-muted">{t.artist}</div>
                        <div className="flex flex-wrap gap-x-2 text-xs">
                          {t.status === 'wishlist' && <span className="text-amber-300">⬇ må skaffes</span>}
                          {isPeak && <span className="text-sky-300">▲ toppen av settet</span>}
                          {warningsAt(i).map((w) => (
                            <span key={w.kind + w.message} className="text-orange-300">
                              ⚠ {w.message}
                            </span>
                          ))}
                        </div>
                      </button>
                      <span className="w-12 text-right text-sm tabular-nums">{t.bpm != null ? t.bpm.toFixed(t.bpm % 1 ? 1 : 0) : '–'}</span>
                      <KeyBadge camelot={t.camelot} showMusical={false} />
                      <button type="button" onClick={() => setEnergyFor(t)} title={`Energi ${t.energy ?? 'ikke satt'} — mål her: ${Math.round(item.targetEnergy)}. Klikk for å endre.`} className="flex flex-col items-center">
                        <EnergyBadge value={t.energy} />
                        <span className="text-[10px] text-muted">mål {Math.round(item.targetEnergy)}</span>
                      </button>
                      <div className="flex w-full shrink-0 justify-end border-t border-line pt-1 sm:w-auto sm:border-0 sm:pt-0">
                        <button type="button" onClick={() => toggleLock(i)} className={`grid h-10 w-10 place-items-center rounded-lg ${slot.locked ? 'text-sky-300' : 'text-muted'} hover:bg-panel2`} title={slot.locked ? 'Låst — beholder plassen når rekkefølgen bygges' : 'Lås til denne plassen'} aria-label="Lås">
                          {slot.locked ? '🔒' : '🔓'}
                        </button>
                        <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-panel2 disabled:opacity-30" aria-label="Flytt opp">
                          ↑
                        </button>
                        <button type="button" onClick={() => move(i, i + 1)} disabled={i === slotTracks.length - 1} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-panel2 disabled:opacity-30" aria-label="Flytt ned">
                          ↓
                        </button>
                        <button type="button" onClick={() => removeAt(i)} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-panel2 hover:text-red-300" aria-label="Ta ut av settet" title="Ta ut av settet (blir liggende i reserve)">
                          ✕
                        </button>
                      </div>
                    </div>

                    {tr && g && (
                      <div className={`my-1 ml-4 flex flex-col gap-1.5 rounded-lg border-l-4 px-3 py-2 text-sm sm:ml-10 ${g.border} ${g.bg}`}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className={`font-semibold ${g.text}`}>
                            {g.icon} {g.word} · {tr.score}
                          </span>
                          <span className="text-slate-300">{tr.explanation}</span>
                          {(gap || tr.grade !== 'good') && (
                            <Button className="!min-h-9 ml-auto !px-3" onClick={() => setBridgeAt(i)}>
                              🔎 Finn brolåt
                            </Button>
                          )}
                        </div>
                        {gap && gap.reasons.length > 0 && <div className="text-xs text-red-200">Hull: {gap.reasons.join(', ')}</div>}
                        <input
                          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-slate-200 placeholder:text-slate-500 hover:border-line focus:border-accent focus:outline-none"
                          placeholder="✎ Notat for overgangen (f.eks. «filter ut bassen på 16 takter»)"
                          value={set.transitionNotes[noteKey] ?? ''}
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
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            {poolOnly.length > 0 && (
              <details className="rounded-xl border border-line bg-panel p-3" open={!slotTracks.length ? false : undefined}>
                <summary className="cursor-pointer text-sm font-medium">Reserve — i potten, men ikke i settet ({poolOnly.length})</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {[...poolOnly]
                    .sort((a, b) => (a.bpm ?? 0) - (b.bpm ?? 0))
                    .map((t) => (
                      <li key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-panel2">
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {t.artist} – {t.title}
                          {t.status === 'wishlist' && <span className="text-amber-300"> ⬇</span>}
                        </span>
                        <span className="w-10 text-right text-sm tabular-nums">{t.bpm ? Math.round(t.bpm) : '–'}</span>
                        <KeyBadge camelot={t.camelot} showMusical={false} />
                        <EnergyBadge value={t.energy} />
                        <button type="button" className="grid h-10 w-10 place-items-center rounded-lg text-accent hover:bg-panel2" onClick={() => append(t.id)} aria-label="Legg til sist i settet" title="Legg til sist i settet">
                          ＋
                        </button>
                        <button type="button" className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-panel2 hover:text-red-300" onClick={() => removeFromPool(t.id)} aria-label="Fjern fra potten" title="Fjern fra potten">
                          ✕
                        </button>
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </div>

          {/* Visualisering */}
          {slotTracks.length > 0 && (
            <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
              <div className="rounded-xl border border-line bg-panel p-3">
                <h3 className="mb-2 text-sm font-semibold">Settet over tid</h3>
                <SetChart analysis={analysis} curve={set.curve} onSelect={scrollTo} />
              </div>
              <div className="flex flex-col items-center rounded-xl border border-line bg-panel p-3">
                <h3 className="mb-2 self-start text-sm font-semibold">Veien rundt Camelot-hjulet</h3>
                <CamelotWheel tracks={slotTracks} />
              </div>
            </div>
          )}
        </div>
      )}

      <TrackPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        tracks={allTracks}
        already={new Set([...set.poolIds, ...inSet])}
        genres={values.genres}
        onAdd={(ids) => update((s) => ({ ...s, poolIds: Array.from(new Set([...s.poolIds, ...ids])) }), true)}
      />
      <AlternativesDialog
        open={altOpen}
        onClose={() => setAltOpen(false)}
        results={alts}
        byId={byId}
        computing={computing}
        targetSec={targetSec}
        onPick={(r) => {
          applyOrder(r.order);
          setAltOpen(false);
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
      <TrackEditor
        open={!!editTrack}
        track={editTrack}
        onClose={() => setEditTrack(null)}
        suggestions={values}
        duplicateOf={(a, ti, v) => byDupKey.get(makeDupKey(a, ti, v)) ?? []}
      />
      <Modal open={!!energyFor} onClose={() => setEnergyFor(null)} title={energyFor ? `Energi: ${energyFor.artist} – ${energyFor.title}` : ''}>
        {energyFor && (
          <EnergyPicker
            value={energyFor.energy}
            onChange={async (v) => {
              await updateTrack(energyFor.id, { energy: v, sources: { ...energyFor.sources, energy: 'manual' } });
              setEnergyFor(null);
            }}
          />
        )}
        <p className="mt-3 text-xs text-muted">1–3 rolig/warm-up · 4–6 groove · 7–8 driv · 9–10 peak</p>
      </Modal>
      <Modal
        open={confirmPlayed}
        onClose={() => setConfirmPlayed(false)}
        title="Marker settet som spilt?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmPlayed(false)}>
              Avbryt
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
              Marker som spilt
            </Button>
          </>
        }
      >
        <p className="text-sm">Alle {slotTracks.length} låtene får +1 i «antall ganger spilt» og «spilt sist» settes til {set.date ? new Date(set.date).toLocaleDateString('no') : 'i dag'}. Da får du advarsel hvis du spiller dem igjen for tett.</p>
      </Modal>
    </div>
  );
}
