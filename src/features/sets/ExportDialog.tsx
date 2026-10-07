import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { DjSet, Track } from '../../db/types';
import type { SetAnalysis } from '../../engine/analysis';
import { camelotToMusical } from '../../engine/camelot';
import { Button, Modal } from '../../components/ui';
import { pairKey } from '../../db/sets';
import { updateTrack } from '../../db/tracks';
import { formatDuration } from '../../lib/normalize';
import { downloadText, safeFilename, setToCsv, setToText, shopLinks } from '../../exporters/setExport';
import { GRADE_STYLE } from './grade';

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for http på mobil (clipboard-API krever sikker kontekst)
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function ExportDialog({ open, onClose, set, tracks, analysis }: { open: boolean; onClose: () => void; set: DjSet; tracks: Track[]; analysis: SetAnalysis<Track> }) {
  const [msg, setMsg] = useState('');
  const [printing, setPrinting] = useState(false);
  const toBuy = tracks.filter((t) => t.status === 'wishlist');
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  };

  const print = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 50);
  };

  return (
    <>
      <Modal open={open} onClose={onClose} wide title="Eksport">
        <div className="flex flex-col gap-6 text-sm">
          <section className="flex flex-col gap-2">
            <h3 className="text-base font-semibold">Handleliste — {toBuy.length ? `${toBuy.length} låter må skaffes` : 'du har alle låtene 🎉'}</h3>
            {toBuy.length > 0 && (
              <>
                <ul className="flex flex-col gap-1">
                  {toBuy.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-panel2 px-3 py-2">
                      <span className="min-w-0 flex-1">
                        {t.artist} – {t.title}
                        {t.version && <span className="text-muted"> ({t.version})</span>}
                      </span>
                      <span className="flex flex-wrap gap-2 text-xs">
                        {shopLinks(t).map((l) => (
                          <a key={l.name} href={l.url} target="_blank" rel="noreferrer" className="rounded border border-line px-2 py-1 text-accent hover:border-accent">
                            {l.name}
                          </a>
                        ))}
                      </span>
                      <Button className="!min-h-9" onClick={() => updateTrack(t.id, { status: 'owned' })}>
                        ✓ Har den nå
                      </Button>
                    </li>
                  ))}
                </ul>
                <div>
                  <Button onClick={async () => flash((await copy(setToText(toBuy))) ? 'Handlelisten er kopiert.' : 'Kunne ikke kopiere.')}>Kopier handlelisten</Button>
                </div>
              </>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-base font-semibold">Til Spotify</h3>
            <p className="text-muted">
              Kopier listen og lim den inn i{' '}
              <a className="text-accent underline" href="https://www.tunemymusic.com/transfer" target="_blank" rel="noreferrer">
                TuneMyMusic
              </a>{' '}
              eller{' '}
              <a className="text-accent underline" href="https://soundiiz.com" target="_blank" rel="noreferrer">
                Soundiiz
              </a>{' '}
              (velg «fra tekst», så Spotify som mål) — da lages spillelisten i riktig rekkefølge.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={async () => flash((await copy(setToText(tracks))) ? 'Listen er kopiert — lim den inn.' : 'Kunne ikke kopiere.')}>
                Kopier som «Artist - Tittel»
              </Button>
              <Button onClick={() => downloadText(setToText(tracks), `${safeFilename(set.name)}.txt`)}>Last ned .txt</Button>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-base font-semibold">Fil og utskrift</h3>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => downloadText(setToCsv(set, tracks, analysis), `${safeFilename(set.name)}.csv`, 'text/csv;charset=utf-8')}>Last ned CSV</Button>
              <Button onClick={print}>🖨 Jukselapp (skriv ut / lagre som PDF)</Button>
            </div>
            <p className="text-xs text-muted">M3U og Rekordbox-XML kommer når appen kan knytte låtene til lydfiler.</p>
          </section>
          {msg && <p className="rounded-lg bg-panel2 px-3 py-2">{msg}</p>}
        </div>
      </Modal>
      {printing && createPortal(<CheatSheet set={set} tracks={tracks} analysis={analysis} />, document.body)}
    </>
  );
}

/** Utskriftsvennlig jukselapp: rekkefølge, tider, BPM, key og notat per overgang. */
export function CheatSheet({ set, tracks, analysis }: { set: DjSet; tracks: Track[]; analysis: SetAnalysis<Track> }) {
  return (
    <div className="print-area">
      <h1>{set.name}</h1>
      <p className="meta">
        {[set.date && new Date(set.date).toLocaleDateString('no', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), set.venue, `${tracks.length} låter`, `ca. ${formatDuration(analysis.totalSec)}`, `snittscore ${analysis.avgScore}`].filter(Boolean).join(' · ')}
      </p>
      {set.notes && <p className="meta">{set.notes}</p>}
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Start</th>
            <th>Låt</th>
            <th>BPM</th>
            <th>Key</th>
            <th>E</th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((t, i) => {
            const tr = analysis.transitions[i];
            const next = tracks[i + 1];
            const note = next ? set.transitionNotes[pairKey(t.id, next.id)] : '';
            return [
              <tr key={t.id} className="track">
                <td>{i + 1}</td>
                <td>{formatDuration(analysis.items[i]?.startSec ?? 0)}</td>
                <td>
                  <strong>{t.artist}</strong> – {t.title}
                  {t.version ? ` (${t.version})` : ''}
                  {t.status === 'wishlist' ? ' ⬇' : ''}
                </td>
                <td>{t.bpm ?? ''}</td>
                <td>
                  {t.camelot ?? ''} <span className="muted">{camelotToMusical(t.camelot, 'short')}</span>
                </td>
                <td>{t.energy ?? ''}</td>
              </tr>,
              tr ? (
                <tr key={`${t.id}-tr`} className="transition">
                  <td />
                  <td colSpan={5}>
                    {GRADE_STYLE[tr.grade].icon} {tr.explanation}
                    {note ? <div className="note">✎ {note}</div> : null}
                  </td>
                </tr>
              ) : null,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
