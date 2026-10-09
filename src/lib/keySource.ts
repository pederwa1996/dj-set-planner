import type { Track } from '../db/types';

/** Er key-en sjekket av deg (eller lest fra filen din)? Da stoler vi på den og overskriver den aldri. */
export const keyChecked = (t: Pick<Track, 'camelot' | 'sources'>) => !!t.camelot && (t.sources?.camelot === 'manual' || t.sources?.camelot === 'tag');

/** Hvor key-en kommer fra, i klartekst */
export function keySourceLabel(t: Pick<Track, 'camelot' | 'sources'>): string {
  if (!t.camelot) return 'no key yet';
  switch (t.sources?.camelot) {
    case 'manual':
      return 'checked by you';
    case 'tag':
      return "from the file's tags";
    case 'import':
      return 'from the imported file (Spotify’s automatic analysis if it came from Exportify)';
    case 'online':
      return 'looked up online';
    case 'analysis':
      return 'from audio analysis';
    case 'estimate':
      return 'estimated';
    default:
      return 'source unknown';
  }
}
