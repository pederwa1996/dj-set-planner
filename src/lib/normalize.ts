/** Fjern aksenter, feat.-deler, tegnsetting og "Original Mix" for duplikatsammenligning. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s*[([]?\b(feat|ft|featuring)\b\.?.*?([)\]]|$)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9æøå]+/g, ' ')
    .replace(/\bthe\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NEUTRAL_VERSIONS = new Set(['', 'original', 'original mix', 'original version', 'album version', 'extended', 'extended mix']);

export function normalizeVersion(v: string): string {
  const n = normalizeText(v);
  return NEUTRAL_VERSIONS.has(n) ? '' : n;
}

export function makeDupKey(artist: string, title: string, version = ''): string {
  // Versjon kan også stå i tittelen: "Song (Club Mix)"
  const m = title.match(/^(.*?)\s*[([]([^)\]]*(mix|remix|edit|dub|version|rework|bootleg)[^)\]]*)[)\]]\s*$/i);
  const baseTitle = m ? m[1] : title;
  const ver = version || (m ? m[2] : '');
  return `${normalizeText(artist)}|${normalizeText(baseTitle)}|${normalizeVersion(ver)}`;
}

/** Fungerer også over http på mobil (der crypto.randomUUID ikke finnes). */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      /* ikke sikker kontekst */
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

export function formatDuration(sec: number | null | undefined): string {
  if (sec == null || !isFinite(sec)) return '';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "6:30", "6.30", "390" → sekunder */
export function parseDuration(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  const m = t.match(/^(\d+)[:.](\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(t);
  return isFinite(n) && n >= 0 ? n : null;
}

/** Tall med komma eller punktum ("127,5") */
export function parseNumber(input: string): number | null {
  const t = input.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return isFinite(n) ? n : null;
}
