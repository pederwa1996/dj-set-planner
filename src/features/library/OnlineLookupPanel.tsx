import { useState } from 'react';
import type { Track } from '../../db/types';
import { Button, KeyBadge } from '../../components/ui';
import { formatDuration } from '../../lib/normalize';
import { changesFromSuggestion, lookupTrack, suggestionFromCandidate, type LookupResult } from '../../sources/lookup';
import { SOURCE_NAMES } from '../../sources/types';

type Draft = Omit<Track, 'id' | 'dupKey' | 'createdAt' | 'updatedAt'>;

const STATUS_TEXT = { ok: 'Funnet', uncertain: 'Usikkert treff — sjekk', notfound: 'Ikke funnet', error: 'Feil ved oppslag' } as const;

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
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-panel2/60 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={!can || busy}>
          {busy ? 'Søker …' : '🌐 Hent data fra nett'}
        </Button>
        {info && (
          <span className={`text-sm ${info.status === 'ok' ? 'text-good' : info.status === 'uncertain' ? 'text-amber-300' : 'text-muted'}`}>
            {STATUS_TEXT[info.status]}
            {info.matched && `: ${info.matched}`}
            {info.confidence > 0 && ` (${Math.round(info.confidence * 100)} % match)`}
          </span>
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
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-panel p-2 text-sm">
          <span className="text-muted">Forslag:</span>
          {sug.bpm && <strong>{sug.bpm} BPM</strong>}
          {sug.camelot && <KeyBadge camelot={sug.camelot} />}
          {sug.durationSec && <span>{formatDuration(sug.durationSec)}</span>}
          {sug.year && <span>{sug.year}</span>}
          {sug.label && <span className="text-muted">{sug.label}</span>}
          <Button variant="primary" className="ml-auto !min-h-9" onClick={() => apply(sug)}>
            Bruk forslag
          </Button>
        </div>
      )}
      {result && result.candidates.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted">Alle treff ({result.candidates.length}) — velg riktig versjon selv</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {result.candidates.map((c) => (
              <li key={`${c.source}-${c.sourceId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-panel px-2 py-1.5 text-sm">
                <span className="w-24 shrink-0 text-xs text-muted">{SOURCE_NAMES[c.source]}</span>
                <span className="min-w-0 flex-1">
                  {c.artist} – {c.title}
                  {c.version && <span className="text-muted"> ({c.version})</span>}
                  <span className={`ml-2 text-xs ${c.confidence >= 0.8 ? 'text-good' : c.confidence >= 0.6 ? 'text-amber-300' : 'text-bad'}`}>{Math.round(c.confidence * 100)} %</span>
                </span>
                <span className="tabular-nums">{c.bpm ? `${c.bpm} BPM` : ''}</span>
                {c.camelot && <KeyBadge camelot={c.camelot} showMusical={false} />}
                <span className="tabular-nums text-muted">{formatDuration(c.durationSec)}</span>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-accent underline">
                    åpne
                  </a>
                )}
                <Button className="!min-h-9 !px-3" onClick={() => apply(suggestionFromCandidate(c))}>
                  Bruk
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
