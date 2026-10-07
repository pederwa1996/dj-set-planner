import { db } from '../db/db';
import { updateTrack } from '../db/tracks';
import { AUTO_APPLY_CONFIDENCE, changesFromSuggestion, lookupTrack } from './lookup';

export interface BulkProgress {
  done: number;
  total: number;
  ok: number;
  uncertain: number;
  notfound: number;
  errors: number;
  current: string;
}

/**
 * Slår opp mange låter etter hverandre (skånsomt mot API-ene).
 * Sikre treff fyller inn tomme felter; usikre lagres bare som forslag til sjekk.
 */
export async function runBulkLookup(ids: string[], onProgress: (p: BulkProgress) => void, signal: AbortSignal): Promise<BulkProgress> {
  const p: BulkProgress = { done: 0, total: ids.length, ok: 0, uncertain: 0, notfound: 0, errors: 0, current: '' };
  for (const id of ids) {
    if (signal.aborted) break;
    const t = await db.tracks.get(id);
    if (!t) {
      p.done++;
      continue;
    }
    p.current = `${t.artist} – ${t.title}`;
    onProgress({ ...p });
    try {
      const r = await lookupTrack({ artist: t.artist, title: t.title, version: t.version }, signal);
      if (signal.aborted) break;
      const s = r.suggestion;
      if (s.info.status === 'ok' && s.info.confidence >= AUTO_APPLY_CONFIDENCE) {
        await updateTrack(id, changesFromSuggestion(t, s, 'fill-empty'));
        p.ok++;
      } else {
        // Lagre forslaget uten å endre verdiene
        await updateTrack(id, { online: s.info });
        if (s.info.status === 'notfound') p.notfound++;
        else if (s.info.status === 'error') p.errors++;
        else p.uncertain++;
      }
    } catch {
      if (signal.aborted) break;
      p.errors++;
    }
    p.done++;
    onProgress({ ...p });
  }
  p.current = '';
  return p;
}
