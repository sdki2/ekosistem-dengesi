import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/content/levels';
import { easyReport, levelReport, perfReport } from './balance/runBalance';

/**
 * Headless balance tests (deterministic: seeded RNG, no rendering).
 * Full human-readable report: `npm run balance`.
 */
describe('headless balance', () => {
  it('default Easy setup survives 300 days in ≥80 % of 20 seeds, with oscillations', () => {
    const r = easyReport();
    expect(r.survivalRate).toBeGreaterThanOrEqual(0.8);
    const surv = r.results.filter((x) => x.survived);
    const meanPeaks = surv.reduce((a, x) => a + x.rabbitPeaks, 0) / surv.length;
    expect(meanPeaks).toBeGreaterThanOrEqual(2); // predator–prey waves, not a flat line
  });

  for (let i = 0; i < LEVELS.length; i++) {
    it(`level ${LEVELS[i]!.id} is solvable by the scripted reasonable player`, () => {
      const seeds = Array.from({ length: 10 }, (_, k) => k + 1);
      const r = levelReport(i, seeds);
      expect(r.playerWin).toBeGreaterThanOrEqual(0.8);
    });
  }

  it('ticks stay fast with ~1,500 animals (spatial hash)', () => {
    const p = perfReport();
    expect(p.animals).toBeGreaterThan(1200);
    // generous bound for slow CI machines; typical is < 1 ms
    expect(p.msPerTick).toBeLessThan(6);
  });
});
