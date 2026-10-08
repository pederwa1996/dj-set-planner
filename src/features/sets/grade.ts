import type { Grade } from '../../engine/transition';

/** Overgangsstatus: farge + ikon + ord (aldri bare farge) */
export const GRADE_STYLE: Record<Grade, { icon: string; word: string; color: string; text: string; bar: string }> = {
  good: { icon: '✓', word: 'Good', color: '#0ca30c', text: 'text-[#5fd35f]', bar: 'bg-good' },
  ok: { icon: '~', word: 'OK', color: '#fab219', text: 'text-ok', bar: 'bg-ok' },
  bad: { icon: '!', word: 'Tricky', color: '#d03b3b', text: 'text-[#f07a7a]', bar: 'bg-bad' },
};
