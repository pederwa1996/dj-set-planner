import type { OnlineInfo, Track } from '../db/types';
import { getSettings } from '../lib/settings';
import { deezerAdapter } from './deezer';
import { getSongBpmAdapter, MissingKeyError } from './getsongbpm';
import { musicBrainzAdapter } from './musicbrainz';
import { SOURCE_NAMES, type Candidate, type LookupQuery, type SourceAdapter, type SourceId } from './types';

/** Minste matchscore for at et treff i det hele tatt brukes */
export const MIN_CONFIDENCE = 0.6;
/** Matchscore som skal til for at verdier fylles inn automatisk i masseoppslag */
export const AUTO_APPLY_CONFIDENCE = 0.8;

export interface Suggestion {
  bpm: number | null;
  camelot: string | null;
  durationSec: number | null;
  year: number | null;
  label: string | null;
  genre: string | null;
  from: Partial<Record<'bpm' | 'camelot' | 'durationSec' | 'year' | 'label' | 'genre', SourceId>>;
  info: OnlineInfo;
}

export interface LookupResult {
  candidates: Candidate[];
  errors: { source: SourceId; message: string }[];
  suggestion: Suggestion;
}

export function activeAdapters(): SourceAdapter[] {
  const s = getSettings();
  const out: SourceAdapter[] = [];
  if (s.sources.getsongbpm && s.getSongBpmKey) out.push(getSongBpmAdapter(s.getSongBpmKey));
  if (s.sources.deezer) out.push(deezerAdapter);
  if (s.sources.musicbrainz) out.push(musicBrainzAdapter);
  return out;
}

const close = (a: number, b: number, pct: number) => Math.abs(a - b) / Math.max(a, b) <= pct;

/** Slå sammen treff fra flere kilder til ett forslag, med kilde per felt og varsler om uenighet. */
export function mergeCandidates(_q: LookupQuery, candidates: Candidate[]): Suggestion {
  const good = candidates.filter((c) => c.confidence >= MIN_CONFIDENCE).sort((a, b) => b.confidence - a.confidence);
  const bestOf = (src: SourceId) => good.find((c) => c.source === src);
  const gs = bestOf('getsongbpm');
  const dz = bestOf('deezer');
  const mb = bestOf('musicbrainz');
  const notes: string[] = [];
  const from: Suggestion['from'] = {};
  let uncertain = false;

  // BPM: GetSongBPM først, Deezer som reserve/bekreftelse
  let bpm: number | null = null;
  if (gs?.bpm) {
    bpm = gs.bpm;
    from.bpm = 'getsongbpm';
    if (dz?.bpm) {
      if (close(gs.bpm, dz.bpm, 0.02)) notes.push(`BPM bekreftet av Deezer (${dz.bpm})`);
      else if (close(gs.bpm * 2, dz.bpm, 0.03) || close(gs.bpm, dz.bpm * 2, 0.03)) {
        notes.push(`Half/double time-uenighet: GetSongBPM ${gs.bpm}, Deezer ${dz.bpm}`);
        uncertain = true;
      } else {
        notes.push(`Uenige om BPM: GetSongBPM ${gs.bpm}, Deezer ${dz.bpm}`);
        uncertain = true;
      }
    }
  } else if (dz?.bpm) {
    bpm = dz.bpm;
    from.bpm = 'deezer';
  }

  const camelot = gs?.camelot ?? null;
  if (camelot) from.camelot = 'getsongbpm';

  const pick = <K extends 'durationSec' | 'label' | 'genre'>(field: K, order: (Candidate | undefined)[]) => {
    for (const c of order) {
      if (c && c[field] != null && c[field] !== '') {
        from[field] = c.source;
        return c[field];
      }
    }
    return null;
  };
  const durationSec = pick('durationSec', [dz, mb, gs]) as number | null;
  const label = pick('label', [dz]) as string | null;
  const genre = pick('genre', [gs, dz]) as string | null;

  // År: tidligste utgivelse blant treffene
  const years = [mb, dz, gs].filter((c): c is Candidate => !!c?.year);
  const yearC = years.sort((a, b) => a.year! - b.year!)[0];
  const year = yearC?.year ?? null;
  if (yearC) from.year = yearC.source;

  const best = good[0];
  const confidence = best?.confidence ?? 0;
  if (best && confidence < AUTO_APPLY_CONFIDENCE) {
    notes.push(`Usikkert treff (${Math.round(confidence * 100)} %): ${best.artist} – ${best.title}${best.version ? ` (${best.version})` : ''}`);
    uncertain = true;
  }
  if (best && !bpm) notes.push('Fant låten, men ingen BPM');
  if (best && !camelot) notes.push(getSettings().getSongBpmKey ? 'Fant ingen key' : 'Key krever GetSongBPM-nøkkel (Innstillinger)');

  const status: OnlineInfo['status'] = !best ? 'notfound' : uncertain ? 'uncertain' : 'ok';
  const usedSources = Array.from(new Set(Object.values(from))).map((s) => SOURCE_NAMES[s]);
  return {
    bpm,
    camelot,
    durationSec,
    year,
    label,
    genre,
    from,
    info: {
      at: new Date().toISOString(),
      status,
      bpm,
      camelot,
      matched: best ? `${best.artist} – ${best.title}${best.version ? ` (${best.version})` : ''}` : '',
      confidence,
      sources: usedSources,
      notes,
    },
  };
}

export async function lookupTrack(q: LookupQuery, signal?: AbortSignal, adapters = activeAdapters()): Promise<LookupResult> {
  const errors: LookupResult['errors'] = [];
  const settled = await Promise.all(
    adapters.map(async (a) => {
      try {
        return await a.search(q, signal);
      } catch (e) {
        if (!(e instanceof MissingKeyError) && !signal?.aborted) errors.push({ source: a.id, message: e instanceof Error ? e.message : String(e) });
        return [] as Candidate[];
      }
    }),
  );
  const candidates = settled.flat().sort((a, b) => b.confidence - a.confidence);
  const suggestion = mergeCandidates(q, candidates);
  if (!candidates.length && errors.length && errors.length === adapters.length) {
    suggestion.info.status = 'error';
    suggestion.info.notes = errors.map((e) => `${SOURCE_NAMES[e.source]}: ${e.message}`);
  }
  return { candidates, errors, suggestion };
}

/**
 * Lag endringer for en låt ut fra et forslag.
 * - 'fill-empty': fyll bare tomme felter (masseoppslag)
 * - 'overwrite': bruk forslagets verdier der de finnes (du valgte treffet selv)
 * Manuelt satte BPM/key overskrives aldri i 'fill-empty'.
 */
export function changesFromSuggestion(t: Track, s: Suggestion, mode: 'fill-empty' | 'overwrite'): Partial<Track> {
  const ch: Partial<Track> = { online: s.info };
  const sources = { ...t.sources };
  const can = (cur: unknown) => mode === 'overwrite' || cur == null || cur === '';
  if (s.bpm != null && can(t.bpm)) {
    ch.bpm = s.bpm;
    sources.bpm = 'online';
  }
  if (s.camelot && can(t.camelot)) {
    ch.camelot = s.camelot;
    sources.camelot = 'online';
  }
  if (s.durationSec != null && can(t.durationSec)) ch.durationSec = s.durationSec;
  if (s.year != null && can(t.year)) ch.year = s.year;
  if (s.label && can(t.label)) ch.label = s.label;
  if (s.genre && !t.genre) ch.genre = s.genre; // sjanger fra nett er grov — fyll bare inn hvis tom
  ch.sources = sources;
  return ch;
}

/** Bruk ett bestemt treff (valgt av deg) som forslag. */
export function suggestionFromCandidate(c: Candidate): Suggestion {
  return {
    bpm: c.bpm,
    camelot: c.camelot,
    durationSec: c.durationSec,
    year: c.year,
    label: c.label,
    genre: c.genre,
    from: {},
    info: {
      at: new Date().toISOString(),
      status: 'ok',
      bpm: c.bpm,
      camelot: c.camelot,
      matched: `${c.artist} – ${c.title}${c.version ? ` (${c.version})` : ''}`,
      confidence: c.confidence,
      sources: [SOURCE_NAMES[c.source]],
      notes: ['Valgt manuelt'],
    },
  };
}
