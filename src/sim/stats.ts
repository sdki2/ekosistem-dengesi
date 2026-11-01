import type { DeathCause } from './agents';

/**
 * Shannon diversity index H = -Σ pᵢ·ln(pᵢ), normalised to 0–100 by ln(S)
 * where S is the number of species groups considered (evenness × 100).
 */
export function shannon(abundances: readonly number[]): { H: number; score: number } {
  let total = 0;
  for (const a of abundances) total += Math.max(0, a);
  if (total <= 0 || abundances.length < 2) return { H: 0, score: 0 };
  let H = 0;
  for (const a of abundances) {
    if (a <= 0) continue;
    const p = a / total;
    H -= p * Math.log(p);
  }
  const score = (H / Math.log(abundances.length)) * 100;
  return { H, score };
}

/** how many plantable tiles count as one plant "individual" for the diversity index */
export const TILES_PER_PLANT_PATCH = 8;

/** biomass units used by the food pyramid */
export const BIOMASS = {
  /** a fully grown tile */
  plantTile: 1,
  rabbit: 1.5,
  wolf: 6,
};

export interface DayLog {
  day: number;
  plantCover: number;
  rabbits: number;
  wolves: number;
  rabbitBirths: number;
  wolfBirths: number;
  rabbitDeaths: Record<DeathCause, number>;
  wolfDeaths: Record<DeathCause, number>;
  shannon: number;
}

export function emptyDeaths(): Record<DeathCause, number> {
  return { starved: 0, old: 0, thirst: 0, eaten: 0, disease: 0, removed: 0 };
}

/** Time series recorded during a run (shared by charts, CSV and collapse narrative). */
export class History {
  /** samples every `sampleEvery` ticks */
  t: number[] = [];
  plants: number[] = [];
  rabbits: number[] = [];
  wolves: number[] = [];
  shannon: number[] = [];
  days: DayLog[] = [];

  clone(): History {
    const h = new History();
    h.t = this.t.slice();
    h.plants = this.plants.slice();
    h.rabbits = this.rabbits.slice();
    h.wolves = this.wolves.slice();
    h.shannon = this.shannon.slice();
    h.days = this.days.map((d) => ({ ...d, rabbitDeaths: { ...d.rabbitDeaths }, wolfDeaths: { ...d.wolfDeaths } }));
    return h;
  }
}

/** mean and coefficient of variation */
export function meanCv(xs: readonly number[]): { mean: number; cv: number } {
  if (xs.length === 0) return { mean: 0, cv: 0 };
  let s = 0;
  for (const x of xs) s += x;
  const mean = s / xs.length;
  let v = 0;
  for (const x of xs) v += (x - mean) * (x - mean);
  v /= xs.length;
  return { mean, cv: mean > 0 ? Math.sqrt(v) / mean : 0 };
}
