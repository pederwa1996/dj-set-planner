import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';
import { IconButton } from '../../components/ui';
import { shopLinks } from '../../exporters/setExport';
import type { WebTrack } from '../../sources/discover';

/** 30 sekunders forhåndslytt (Deezer). Én spiller deles av hele dialogen. */
export function usePreview(open: boolean) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  useEffect(() => {
    if (!open) {
      audio.current?.pause();
      setPlaying(null);
    }
  }, [open]);

  function toggle(id: string, url: string) {
    if (!audio.current) {
      audio.current = new Audio();
      audio.current.addEventListener('ended', () => setPlaying(null));
    }
    if (playing === id) {
      audio.current.pause();
      setPlaying(null);
      return;
    }
    audio.current.src = url;
    void audio.current.play().catch(() => setPlaying(null));
    setPlaying(id);
  }
  return { playing, toggle };
}

/**
 * Én rad for en låt fra nettet: spillknapp + artist – tittel, hvorfor den er med og lenker,
 * og `side` (BPM, key, knapper …) til høyre – på mobil på en egen linje under tittelen.
 */
export function WebTrackRow({ track, preview, lead, side, dim }: { track: WebTrack; preview: ReturnType<typeof usePreview>; lead?: ReactNode; side: ReactNode; dim?: boolean }) {
  return (
    <li className={`flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm ${dim ? 'opacity-50' : 'hover:bg-raised/60'}`}>
      {lead}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <WebTrackMain track={track} preview={preview} />
        <div className="flex flex-1 flex-wrap items-center justify-end gap-x-3 gap-y-1 pl-[3.25rem] sm:flex-none sm:flex-nowrap sm:pl-0">{side}</div>
      </div>
    </li>
  );
}

/** Spillknapp + artist – tittel, hvorfor den er med, og lenker til Beatport/Spotify */
export function WebTrackMain({ track: t, preview }: { track: WebTrack; preview: ReturnType<typeof usePreview> }) {
  const links = shopLinks(t).filter((l) => l.name === 'Beatport' || l.name === 'Spotify');
  const on = preview.playing === t.id;
  return (
    <>
      {t.preview ? (
        <IconButton label={on ? 'Pause preview' : 'Play 30-second preview'} active={on} onClick={() => preview.toggle(t.id, t.preview!)}>
          {on ? <Pause size={16} /> : <Play size={16} />}
        </IconButton>
      ) : (
        <span className="w-10 shrink-0" />
      )}
      <span className="min-w-0 flex-1 basis-[calc(100%-3.25rem)] sm:basis-0">
        <span className="block truncate">
          {t.artist} – {t.title}
          {t.version && <span className="text-muted"> · {t.version}</span>}
        </span>
        <span className="flex flex-wrap gap-x-2 text-xs text-muted">
          <span>{t.reason}</span>
          {links.map((l) => (
            <a key={l.name} href={l.url} target="_blank" rel="noreferrer" className="hover:text-ink hover:underline">
              {l.name}
            </a>
          ))}
        </span>
      </span>
    </>
  );
}
