export type TrackStatus = 'owned' | 'wishlist';
export type FieldSource = 'manual' | 'tag' | 'analysis' | 'import';

export interface Track {
  id: string;
  artist: string;
  title: string;
  version: string; // remix/versjon, f.eks. "Original Mix"
  label: string;
  year: number | null;
  durationSec: number | null;

  bpm: number | null;
  camelot: string | null; // "8A" — vanlig notasjon avledes fra denne
  energy: number | null; // 1–10

  genre: string;
  subgenre: string;
  tags: string[];
  mood: string;
  rating: number; // 0–5 (0 = ikke vurdert)
  notes: string;

  introBars: number | null;
  outroBars: number | null;

  status: TrackStatus;
  playCount: number;
  lastPlayedAt: string | null; // ISO-dato

  /** Forslag fra lydanalyse (fase 2). Overskriver aldri verdiene over. */
  analysis: { bpm: number | null; camelot: string | null; confidence: number | null } | null;
  /** Hvor BPM/key kom fra */
  sources: { bpm?: FieldSource; camelot?: FieldSource };

  file: { name: string; size: number; hasAudio: boolean } | null;

  /** Normalisert artist+tittel+versjon for duplikatsjekk */
  dupKey: string;
  createdAt: string;
  updatedAt: string;
}

export type NewTrack = Partial<Omit<Track, 'id' | 'dupKey' | 'createdAt' | 'updatedAt'>> &
  Pick<Track, 'artist' | 'title'>;
