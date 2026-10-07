export interface LookupQuery {
  artist: string;
  title: string;
  version?: string;
}

export type SourceId = 'getsongbpm' | 'deezer' | 'musicbrainz';

export const SOURCE_NAMES: Record<SourceId, string> = {
  getsongbpm: 'GetSongBPM',
  deezer: 'Deezer',
  musicbrainz: 'MusicBrainz',
};

/** Ett treff fra én kilde */
export interface Candidate {
  source: SourceId;
  sourceId: string;
  artist: string;
  title: string;
  version: string;
  bpm: number | null;
  camelot: string | null;
  durationSec: number | null;
  year: number | null;
  label: string | null;
  album: string | null;
  genre: string | null;
  url: string | null;
  /** Hvor godt treffet matcher det vi søkte etter, 0–1 */
  confidence: number;
}

export interface SourceAdapter {
  id: SourceId;
  search(q: LookupQuery, signal?: AbortSignal): Promise<Candidate[]>;
}

export function emptyCandidate(source: SourceId, sourceId: string): Candidate {
  return { source, sourceId, artist: '', title: '', version: '', bpm: null, camelot: null, durationSec: null, year: null, label: null, album: null, genre: null, url: null, confidence: 0 };
}
