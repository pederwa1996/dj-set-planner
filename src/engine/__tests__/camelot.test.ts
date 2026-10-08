import {
  ALL_CAMELOT,
  camelotSortValue,
  camelotToMusical,
  compatibleKeys,
  harmonicCompatibility,
  toCamelot,
  wheelStep,
} from '../camelot';

describe('key-konvertering', () => {
  it.each([
    ['A minor', '8A'],
    ['Am', '8A'],
    ['a min', '8A'],
    ['A moll', '8A'],
    ['C major', '8B'],
    ['C', '8B'],
    ['C dur', '8B'],
    ['G#m', '1A'],
    ['Abm', '1A'],
    ['B', '1B'],
    ['F#m', '11A'],
    ['Gbm', '11A'],
    ['Db major', '3B'],
    ['C#', '3B'],
    ['E♭', '5B'],
    ['C#m', '12A'],
    ['E', '12B'],
    ['Bbmaj', '6B'],
  ])('%s → %s', (input, expected) => {
    expect(toCamelot(input)).toBe(expected);
  });

  it('godtar Camelot direkte og normaliserer', () => {
    expect(toCamelot('08a')).toBe('8A');
    expect(toCamelot(' 12 B ')).toBe('12B');
  });

  it('godtar Open Key (Traktor)', () => {
    expect(toCamelot('1m')).toBe('8A');
    expect(toCamelot('1d')).toBe('8B');
    expect(toCamelot('6m')).toBe('1A');
  });

  it('avviser tull', () => {
    expect(toCamelot('13A')).toBeNull();
    expect(toCamelot('H minor')).toBeNull();
    expect(toCamelot('')).toBeNull();
    expect(toCamelot(null)).toBeNull();
  });

  it('rundtur Camelot → vanlig → Camelot for alle 24 keys', () => {
    for (const c of ALL_CAMELOT) {
      expect(toCamelot(camelotToMusical(c))).toBe(c);
      expect(toCamelot(camelotToMusical(c, 'short'))).toBe(c);
    }
  });

  it('formaterer vanlig notasjon', () => {
    expect(camelotToMusical('8A')).toBe('A minor');
    expect(camelotToMusical('8B', 'short')).toBe('C');
    expect(camelotToMusical('1A', 'short')).toBe('Abm');
  });
});

describe('hjulet', () => {
  it('wheelStep går rundt', () => {
    expect(wheelStep(12, 1)).toBe(1);
    expect(wheelStep(1, 12)).toBe(-1);
    expect(wheelStep(8, 3)).toBe(-5);
    expect(wheelStep(3, 9)).toBe(6);
  });

  it('klassifiserer overganger', () => {
    expect(harmonicCompatibility('8A', '8A')!.relation).toBe('same');
    expect(harmonicCompatibility('8A', '9A')!.relation).toBe('adjacent');
    expect(harmonicCompatibility('1A', '12A')!.relation).toBe('adjacent');
    expect(harmonicCompatibility('8A', '8B')!.relation).toBe('relative');
    expect(harmonicCompatibility('8A', '9B')!.relation).toBe('diagonal');
    expect(harmonicCompatibility('8B', '7A')!.relation).toBe('diagonal');
    expect(harmonicCompatibility('8A', '10A')!.relation).toBe('boost2');
    expect(harmonicCompatibility('8A', '3A')!.relation).toBe('boost7');
    expect(harmonicCompatibility('8A', '2B')!.relation).toBe('clash');
  });

  it('scorer i riktig rekkefølge', () => {
    const s = (a: string, b: string) => harmonicCompatibility(a, b)!.score;
    expect(s('8A', '8A')).toBeGreaterThan(s('8A', '9A'));
    expect(s('8A', '9A')).toBeGreaterThan(s('8A', '8B'));
    expect(s('8A', '8B')).toBeGreaterThan(s('8A', '10A'));
    expect(s('8A', '10A')).toBeGreaterThan(s('8A', '2B'));
  });

  it('gir forklaring', () => {
    expect(harmonicCompatibility('8A', '9A')!.label).toBe('+1 on the wheel');
  });

  it('lister kompatible keys', () => {
    expect(compatibleKeys('12A').sort()).toEqual(['11A', '12A', '12B', '1A'].sort());
    expect(compatibleKeys('8A', { includeBoosts: true })).toContain('10A');
    expect(compatibleKeys('8A', { includeBoosts: true })).toContain('3A');
  });

  it('sorterer 1A < 1B < 2A < 12B', () => {
    const sorted = ['12B', '2A', '1B', '1A'].sort((a, b) => camelotSortValue(a) - camelotSortValue(b));
    expect(sorted).toEqual(['1A', '1B', '2A', '12B']);
  });
});
