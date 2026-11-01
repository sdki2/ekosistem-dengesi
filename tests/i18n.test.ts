import { describe, expect, it } from 'vitest';
import { STR, fmt, trSuffix } from '../src/content/i18n';

describe('Turkish number suffixes', () => {
  it('dative', () => {
    expect(fmt('{n:dat}', { n: 30 })).toBe("30'a");
    expect(fmt('{n:dat}', { n: 35 })).toBe("35'e");
    expect(fmt('{n:dat}', { n: 12 })).toBe("12'ye");
    expect(fmt('{n:dat}', { n: 6 })).toBe("6'ya");
    expect(fmt('{n:dat}', { n: 100 })).toBe("100'e");
    expect(fmt('{n:dat}', { n: 9 })).toBe("9'a");
  });
  it('genitive, ablative, possessive', () => {
    expect(trSuffix('20', 'gen')).toBe('nin');
    expect(trSuffix('30', 'gen')).toBe('un');
    expect(trSuffix('0,55', 'abl')).toBe('ten');
    expect(trSuffix('0,40', 'abl')).toBe('tan');
    expect(trSuffix('30', 'poss')).toBe('unu');
    expect(trSuffix('20', 'poss')).toBe('sini');
  });
  it('templates read correctly', () => {
    expect(fmt(STR.collapse.wolfPeak, { day: 44, n: 30 })).toBe('Kurt sayısı 44. günde 30\'a yükseldi.');
    expect(fmt(STR.levels.star3, { n: 50 })).toBe("Bütçenin en fazla %50'sini harca");
  });
});
