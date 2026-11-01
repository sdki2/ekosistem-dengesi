import { cloneConfig, type SimConfig } from '../../src/config';
import { World, type WorldOptions } from '../../src/sim/world';

export interface RunResult {
  seed: number;
  survived: boolean;
  /** day of the first extinction, or `days` if none */
  lastDay: number;
  /** which species died first: r / w / - */
  died: string;
  rabbitMin: number;
  rabbitMax: number;
  wolfMin: number;
  wolfMax: number;
  plantMin: number;
  /** number of rabbit peaks (local maxima with ≥30 % swing) → oscillation evidence */
  rabbitPeaks: number;
  msPerTick: number;
}

export type Controller = (w: World, day: number) => void;

/** deep-merge partial overrides into a config */
export function withOverrides(over: DeepPartial<SimConfig> = {}): SimConfig {
  const c = cloneConfig();
  const merge = (dst: Record<string, unknown>, src: Record<string, unknown>) => {
    for (const k of Object.keys(src)) {
      const v = src[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) merge(dst[k] as Record<string, unknown>, v as Record<string, unknown>);
      else dst[k] = v;
    }
  };
  merge(c as unknown as Record<string, unknown>, over as Record<string, unknown>);
  return c;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export function runOne(opts: WorldOptions, days: number, controller?: Controller, warmupDays = 0): RunResult {
  const w = new World(opts);
  const tpd = w.cfg.ticksPerDay;
  let rMin = Infinity, rMax = 0, wMin = Infinity, wMax = 0, pMin = Infinity;
  let survived = true;
  let lastDay = days;
  let died = '-';
  const t0 = performance.now();
  const daily: number[] = [];
  for (let d = 1; d <= days; d++) {
    controller?.(w, d);
    w.run(tpd);
    w.drainEvents();
    const r = w.counts[0];
    const wo = w.counts[1];
    daily.push(r);
    if (d > warmupDays) {
      rMin = Math.min(rMin, r);
      rMax = Math.max(rMax, r);
      wMin = Math.min(wMin, wo);
      wMax = Math.max(wMax, wo);
      pMin = Math.min(pMin, w.plantCover());
    }
    if (r === 0 || wo === 0) {
      survived = false;
      lastDay = d;
      died = r === 0 ? 'r' : 'w';
      break;
    }
  }
  const ms = (performance.now() - t0) / Math.max(1, w.tick);
  return {
    seed: opts.seed,
    survived,
    lastDay,
    died,
    rabbitMin: rMin === Infinity ? 0 : rMin,
    rabbitMax: rMax,
    wolfMin: wMin === Infinity ? 0 : wMin,
    wolfMax: wMax,
    plantMin: pMin === Infinity ? 0 : pMin,
    rabbitPeaks: countPeaks(daily),
    msPerTick: ms,
  };
}

/** count peaks separated by troughs at least 30 % lower (smoothed over 5 days) */
export function countPeaks(xs: number[]): number {
  if (xs.length < 10) return 0;
  const s = xs.map((_, i) => {
    let a = 0, n = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(xs.length - 1, i + 2); k++) { a += xs[k]!; n++; }
    return a / n;
  });
  let peaks = 0;
  let hi = s[0]!, lo = s[0]!;
  let rising = true;
  for (const v of s) {
    if (rising) {
      if (v > hi) hi = v;
      else if (v < hi * 0.7) { peaks++; rising = false; lo = v; }
    } else {
      if (v < lo) lo = v;
      else if (v > lo * 1.3 + 2) { rising = true; hi = v; }
    }
  }
  return peaks;
}

export interface Summary {
  survivalRate: number;
  results: RunResult[];
}

export function runSeeds(make: (seed: number) => WorldOptions, seeds: number[], days: number, controller?: Controller): Summary {
  const results = seeds.map((s) => runOne(make(s), days, controller, 20));
  return { survivalRate: results.filter((r) => r.survived).length / results.length, results };
}

export function fmt(s: Summary): string {
  const rs = s.results;
  const surv = rs.filter((r) => r.survived);
  const pick = surv.length ? surv : rs;
  const range = (f: (r: RunResult) => number, g: (r: RunResult) => number) =>
    `${Math.min(...pick.map(f))}–${Math.max(...pick.map(g))}`;
  const fails = rs.filter((r) => !r.survived).map((r) => `s${r.seed}${r.died}@d${r.lastDay}`).join(' ');
  return [
    `hayatta kalma ${(s.survivalRate * 100).toFixed(0)}% (${surv.length}/${rs.length})`,
    `tavşan ${range((r) => r.rabbitMin, (r) => r.rabbitMax)}`,
    `kurt ${range((r) => r.wolfMin, (r) => r.wolfMax)}`,
    `bitki min ${Math.min(...pick.map((r) => r.plantMin)).toFixed(0)}%`,
    `zirve/koşu ${(pick.reduce((a, r) => a + r.rabbitPeaks, 0) / pick.length).toFixed(1)}`,
    `${(rs.reduce((a, r) => a + r.msPerTick, 0) / rs.length).toFixed(3)} ms/tick`,
    fails ? `çöküşler: ${fails}` : '',
  ].filter(Boolean).join(' | ');
}
