import type { ReactNode } from 'react';
import type { Track } from '../db/types';
import { openTrack } from '../lib/uiStore';
import { EnergyBadge, KeyBadge, StatusPill } from './ui';

/** Kompakt låtrad (lister i Browse, hjem og mobilbiblioteket). Klikk åpner låten. */
export function TrackRow({ t, leading, trailing, badges, showGenre = true }: { t: Track; leading?: ReactNode; trailing?: ReactNode; badges?: ReactNode; showGenre?: boolean }) {
  return (
    <div className="group flex min-h-14 items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-raised/50">
      {leading}
      <button type="button" className="min-w-0 flex-1 py-1 text-left" onClick={() => openTrack(t)}>
        <div className="truncate text-[15px] text-ink">
          {t.title}
          {t.version && <span className="text-muted"> · {t.version}</span>}
        </div>
        <div className="flex items-center gap-2 truncate text-[13px] text-muted">
          <span className="truncate">
            {t.artist}
            {showGenre && t.genre && ` · ${t.genre}`}
          </span>
          {badges}
        </div>
      </button>
      <span className="w-11 shrink-0 text-right text-sm tabular-nums text-ink2">{t.bpm != null ? Math.round(t.bpm * 10) / 10 : '–'}</span>
      <span className="w-12 shrink-0">
        <KeyBadge camelot={t.camelot} showMusical={false} />
      </span>
      <EnergyBadge value={t.energy} />
      <span className="hidden w-16 shrink-0 sm:block">
        <StatusPill status={t.status} />
      </span>
      {trailing}
    </div>
  );
}
