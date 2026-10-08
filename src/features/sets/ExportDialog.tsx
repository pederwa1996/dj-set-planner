import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, FileDown, Printer } from 'lucide-react';
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
    // Reserve for http på mobil (clipboard-API krever sikker kontekst)
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="serif text-lg">{title}</h3>
      {children}
    </section>
  );
}

export function ExportDialog({ open, onClose, set, tracks, analysis }: { open: boolean; onClose: () => void; set: DjSet; tracks: Track[]; analysis: SetAnalysis<Track> }) {
  const [msg, setMsg] = useState('');
  const [printing, setPrinting] = useState(false);
  const toGet = tracks.filter((t) => t.status === 'wishlist');
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
      <Modal open={open} onClose={onClose} wide title="Export">
        <div className="flex flex-col gap-8 text-sm">
          <Section title={toGet.length ? `Shopping list · ${toGet.length} to get` : 'Shopping list · you have every track'}>
            {toGet.length > 0 && (
              <>
                <ul className="flex flex-col gap-1">
                  {toGet.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line/60 px-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        {t.artist} – {t.title}
                        {t.version && <span className="text-muted"> · {t.version}</span>}
                      </span>
                      <span className="flex flex-wrap gap-1.5 text-xs">
                        {shopLinks(t).map((l) => (
                          <a key={l.name} href={l.url} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-2 py-1 text-ink2 transition hover:border-[#5c5752] hover:text-ink">
                            {l.name}
                          </a>
                        ))}
                      </span>
                      <Button size="sm" onClick={() => updateTrack(t.id, { status: 'owned' })}>
                        <Check size={14} /> Got it
                      </Button>
                    </li>
                  ))}
                </ul>
                <div>
                  <Button size="sm" onClick={async () => flash((await copy(setToText(toGet))) ? 'Shopping list copied.' : 'Couldn’t copy.')}>
                    <Copy size={14} /> Copy shopping list
                  </Button>
                </div>
              </>
            )}
          </Section>

          <Section title="To Spotify">
            <p className="text-ink2">
              Copy the list and paste it into{' '}
              <a className="text-accent hover:underline" href="https://www.tunemymusic.com/transfer" target="_blank" rel="noreferrer">
                TuneMyMusic
              </a>{' '}
              or{' '}
              <a className="text-accent hover:underline" href="https://soundiiz.com" target="_blank" rel="noreferrer">
                Soundiiz
              </a>{' '}
              (choose “from text”, then Spotify as the destination) to get a playlist in the right order.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={async () => flash((await copy(setToText(tracks))) ? 'Copied — paste it in.' : 'Couldn’t copy.')}>
                <Copy size={16} /> Copy as “Artist - Title”
              </Button>
              <Button onClick={() => downloadText(setToText(tracks), `${safeFilename(set.name)}.txt`)}>
                <FileDown size={16} /> Download .txt
              </Button>
            </div>
          </Section>

          <Section title="File and print">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => downloadText(setToCsv(set, tracks, analysis), `${safeFilename(set.name)}.csv`, 'text/csv;charset=utf-8')}>
                <FileDown size={16} /> Download CSV
              </Button>
              <Button onClick={print}>
                <Printer size={16} /> Cheat sheet (print / save as PDF)
              </Button>
            </div>
            <p className="text-xs text-muted">M3U and Rekordbox XML will come once tracks can be linked to audio files.</p>
          </Section>
          {msg && <p className="rounded-xl bg-raised px-4 py-3">{msg}</p>}
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
        {[set.date && new Date(`${set.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), set.venue, `${tracks.length} tracks`, `~${formatDuration(analysis.totalSec)}`, `flow ${analysis.avgScore}`]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {set.notes && <p className="meta">{set.notes}</p>}
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Start</th>
            <th>Track</th>
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
                  {t.status === 'wishlist' ? ' ↓' : ''}
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
