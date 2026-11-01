import { Rng, hashSeed } from './rng';

/** Weather spells. The order is part of the save format (snapshots store the index). */
export const enum Wx {
  Clear,
  Cloudy,
  Rain,
  Storm,
  Heat,
  Fog,
  Snow,
}

export const WX_COUNT = 7;

/** per-weather effects on the world */
interface WxEffect {
  /** soil moisture change per tick */
  moisture: number;
  /** animal sight multiplier (fog and storms hide both hunter and hunted) */
  vision: number;
  /** thirst multiplier (river map) */
  thirst: number;
  /** metabolism multiplier */
  metabolism: number;
  /** wolf scent-tracking multiplier (rain washes scents away) */
  scent: number;
  /** direct plant growth multiplier on top of soil moisture */
  regrow: number;
}

export const WX_EFFECT: Record<number, WxEffect> = {
  [Wx.Clear]: { moisture: -0.0034, vision: 1, thirst: 1, metabolism: 1, scent: 1, regrow: 1.05 },
  [Wx.Cloudy]: { moisture: -0.0018, vision: 1, thirst: 0.9, metabolism: 1, scent: 1, regrow: 1 },
  [Wx.Rain]: { moisture: 0.0072, vision: 0.85, thirst: 0.6, metabolism: 1, scent: 0.5, regrow: 1.25 },
  [Wx.Storm]: { moisture: 0.009, vision: 0.6, thirst: 0.6, metabolism: 1.1, scent: 0.25, regrow: 1.15 },
  [Wx.Heat]: { moisture: -0.0085, vision: 1, thirst: 1.7, metabolism: 1.08, scent: 1, regrow: 0.6 },
  [Wx.Fog]: { moisture: -0.001, vision: 0.55, thirst: 0.9, metabolism: 1, scent: 1.2, regrow: 1 },
  [Wx.Snow]: { moisture: 0.0006, vision: 0.8, thirst: 0.8, metabolism: 1.1, scent: 0.7, regrow: 0.2 },
};

/**
 * Next-spell weights by season (spring, summer, autumn, winter, no-seasons).
 * Columns: clear, cloudy, rain, storm, heat, fog, snow.
 */
const TABLE: number[][] = [
  [4, 3, 4, 1, 0, 1, 0], // spring
  [5, 2, 2, 1.2, 3, 0.3, 0], // summer
  [3, 3, 3, 1, 0, 3, 0], // autumn
  [2, 3, 0.5, 0, 0, 2, 5], // winter
  [4, 3, 3, 1, 1.4, 1, 0], // seasons off
];

/**
 * Weather as a small seeded state machine. It owns a private RNG so turning
 * weather on or off never changes the animals' random streams.
 */
export class WeatherState {
  kind: Wx = Wx.Clear;
  /** tick the current spell ends */
  until = 0;
  /** soil moisture 0–1 */
  moisture: number;
  /** river / pond level 0–1, follows soil moisture slowly */
  water: number;
  /** forecast: the next spell */
  next: Wx = Wx.Clear;
  rng: Rng;

  constructor(seed: number, moistureStart: number) {
    this.rng = new Rng(hashSeed(seed) ^ 0x57ea7e);
    this.moisture = moistureStart;
    this.water = moistureStart;
    this.next = Wx.Clear;
  }

  get effect(): WxEffect {
    return WX_EFFECT[this.kind]!;
  }

  /** advance one tick; returns the new kind when the weather changed */
  step(tick: number, season: number, minTicks: number, maxTicks: number, forced: 'drought' | 'winter' | null): Wx | null {
    const e = WX_EFFECT[this.kind]!;
    this.moisture = Math.min(1, Math.max(0, this.moisture + e.moisture));
    this.water += (this.moisture - this.water) * 0.012;
    if (tick < this.until) return null;
    const prev = this.kind;
    this.kind = tick === 0 && this.until === 0 ? this.pick(season, forced) : this.next;
    this.next = this.pick(season, forced);
    this.until = tick + this.rng.int(minTicks, maxTicks);
    return this.kind !== prev ? this.kind : null;
  }

  private pick(season: number, forced: 'drought' | 'winter' | null): Wx {
    const row = (TABLE[season < 0 ? 4 : season] ?? TABLE[4]!).slice();
    if (forced === 'drought') {
      row[Wx.Heat] = 6;
      row[Wx.Rain] = 0;
      row[Wx.Storm] = 0;
    } else if (forced === 'winter') {
      row[Wx.Snow] = 6;
      row[Wx.Rain] = 0;
      row[Wx.Heat] = 0;
    }
    let total = 0;
    for (const v of row) total += v;
    let r = this.rng.next() * total;
    for (let k = 0; k < row.length; k++) {
      r -= row[k]!;
      if (r < 0) return k as Wx;
    }
    return Wx.Clear;
  }
}
