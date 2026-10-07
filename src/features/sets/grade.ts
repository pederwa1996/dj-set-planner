import type { Grade } from '../../engine/transition';

/** Overgangsstatus: farge + ikon + ord (aldri bare farge) */
export const GRADE_STYLE: Record<Grade, { icon: string; word: string; color: string; text: string; bg: string; border: string }> = {
  good: { icon: '✓', word: 'god', color: '#22c55e', text: 'text-green-300', bg: 'bg-green-950/40', border: 'border-green-600/70' },
  ok: { icon: '~', word: 'ok', color: '#eab308', text: 'text-yellow-200', bg: 'bg-yellow-950/30', border: 'border-yellow-500/70' },
  bad: { icon: '!', word: 'vanskelig', color: '#ef4444', text: 'text-red-300', bg: 'bg-red-950/40', border: 'border-red-500/80' },
};
