/** Minimal låt-modell for mix-motoren (uavhengig av database og UI). */
export interface MixTrack {
  id: string;
  artist: string;
  title: string;
  version?: string;
  bpm: number | null;
  camelot: string | null;
  energy: number | null;
  durationSec: number | null;
}
