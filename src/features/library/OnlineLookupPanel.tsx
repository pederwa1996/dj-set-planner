import { useState } from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import type { Track } from '../../db/types';
import { Button, KeyBadge } from '../../components/ui';
import { formatDuration } from '../../lib/normalize';
import { changesFromSuggestion, lookupTrack, suggestionFromCandidate, type LookupResult } from '../../sources/lookup';
import { SOURCE_NAMES } from '../../sources/types';

type Draft = Omit<Track, 'id' | 'dupKey' | 'createdAt' | 'updatedAt'>;

const STATUS_TEXT = { ok: 'Found', uncertain: 'Uncertain match — please check', notfound: 'Not found', error: 'Lookup failed' } as const;
const STATUS_COLOR = { ok: 'text-good', uncertain: 'text-ok', notfound: 'text-muted', error: 'text-bad' } as const;

export function OnlineLookupPanel({ draft, onApply }: { draft: Draft; onApply: (changes: Partial<Draft>) => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const can = draft.artist.trim() && draft.title.trim();

  async function run() {
    setBusy(true);
    try {
      setResult(await lookupTrack({ artist: draft.artist, title: draft.title, version: draft.version }));
    } finally {
      setBusy(false);
    }
  }

  const apply = (s: LookupResult['suggestion']) => onApply(changesFromSuggestion({ ...draft } as Track, s, 'overwrite'));
  const info = result?.suggestion.info ?? draft.online;
  const sug = result?.suggestion;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-sidebar/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={run} disabled={!can || busy}>
          <Globe size={15} /> {busy ? 'Searching…' : 'Look up online'}
        </Button>
        {info ? (
          <span className={`text-[13px] ${STATUS_COLOR[info.status]}`}>
            {STATUS_TEXT[info.status]}
            {info.matched && <span className="text-ink2">: {info.matched}</span>}
            {info.confidence > 0 && <span className="text-muted"> · {Math.round(info.confidence * 100)}% match</span>}
          </span>
        ) : (
          <span className="text-[13px] text-muted">Fills in BPM, key, length, year and label from GetSongBPM, Deezer and MusicBrainz.</span>
        )}
      </div>
      {info && info.notes.length > 0 && (
        <ul className="list-inside list-disc text-xs text-muted">
          {info.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {sug && (sug.bpm || sug.camelot || sug.durationSec) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface px-3 py-2 text-sm">
          <span className="text-muted">Suggestion</span>
          {sug.bpm && <strong className="font-medium">{sug.bpm} BPM</strong>}
          {sug.camelot && <KeyBadge camelot={sug.camelot} link={false} />}
          {sug.durationSec && <span>{formatDuration(sug.durationSec)}</span>}
          {sug.year && <span>{sug.year}</span>}
          {sug.label && <span className="text-muted">{sug.label}</span>}
          <Button size="sm" variant="primary" className="ml-auto" onClick={() => apply(sug)}>
            Use suggestion
          </Button>
        </div>
      )}
      {result && result.candidates.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[13px] text-muted hover:text-ink">All matches ({result.candidates.length}) — pick the right version yourself</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {result.candidates.map((c) => (
              <li key={`${c.source}-${c.sourceId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-surface px-3 py-2 text-sm">
                <span className="w-24 shrink-0 text-xs text-muted">{SOURCE_NAMES[c.source]}</span>
                <span className="min-w-0 flex-1">
                  {c.artist} – {c.title}
                  {c.version && <span className="text-muted"> ({c.version})</span>}
                  <span className={`ml-2 text-xs ${c.confidence >= 0.8 ? 'text-good' : c.confidence >= 0.6 ? 'text-ok' : 'text-bad'}`}>{Math.round(c.confidence * 100)}%</span>
                </span>
                <span className="tabular-nums">{c.bpm ? `${c.bpm} BPM` : ''}</span>
                {c.camelot && <KeyBadge camelot={c.camelot} showMusical={false} link={false} />}
                <span className="tabular-nums text-muted">{formatDuration(c.durationSec)}</span>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-muted hover:text-ink" aria-label="Open source">
                    <ExternalLink size={14} />
                  </a>
                )}
                <Button size="sm" onClick={() => apply(suggestionFromCandidate(c))}>
                  Use
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {result?.errors.map((e) => (
        <p key={e.source} className="text-xs text-bad">
          {SOURCE_NAMES[e.source]}: {e.message}
        </p>
      ))}
    </div>
  );
}
