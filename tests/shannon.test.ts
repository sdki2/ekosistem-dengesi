import { describe, expect, it } from 'vitest';
import { meanCv, shannon } from '../src/sim/stats';

describe('Shannon index', () => {
  it('is maximal (100) for perfectly even abundances', () => {
    const r = shannon([10, 10, 10]);
    expect(r.H).toBeCloseTo(Math.log(3), 10);
    expect(r.score).toBeCloseTo(100, 6);
  });
  it('is 0 when only one species exists', () => {
    expect(shannon([50, 0, 0]).score).toBe(0);
  });
  it('matches a hand-computed value', () => {
    // p = 0.5, 0.25, 0.25
    const r = shannon([2, 1, 1]);
    expect(r.H).toBeCloseTo(-(0.5 * Math.log(0.5) + 2 * 0.25 * Math.log(0.25)), 10);
    expect(r.score).toBeCloseTo((r.H / Math.log(3)) * 100, 10);
  });
  it('handles empty input', () => {
    expect(shannon([0, 0, 0]).score).toBe(0);
  });
  it('meanCv works', () => {
    expect(meanCv([5, 5, 5]).cv).toBe(0);
    expect(meanCv([0, 10]).cv).toBeCloseTo(1, 10);
  });
});
