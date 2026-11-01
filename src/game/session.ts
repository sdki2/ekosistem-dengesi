import { ECONOMY, cloneConfig, type SimConfig } from '../config';
import type { LevelDef } from '../content/levels';
import { Species } from '../sim/agents';
import type { MapKind } from '../sim/grid';
import { meanCv } from '../sim/stats';
import { World, type SimEvent, type WorldSnapshot } from '../sim/world';

export type Mode = 'scenario' | 'sandbox';
export type Tool = 'plant' | 'rabbit' | 'wolf' | 'inspect' | 'remove';
export type Status = 'playing' | 'won' | 'lost';

export interface SessionOptions {
  mode: Mode;
  level?: LevelDef;
  map?: MapKind;
  seed?: number;
  seasons?: boolean;
  weather?: boolean;
  randomEvents?: boolean;
  cfg?: SimConfig;
}

export interface PlaceResult {
  ok: boolean;
  count: number;
  reason?: 'budget' | 'blocked' | 'cap';
}

interface Snap {
  day: number;
  world: WorldSnapshot;
  budget: number;
  spent: number;
}

/**
 * One play-through: the World plus game rules (budget, goals, stars,
 * collapse detection, rewind). No DOM — the scripted balance player uses it too.
 */
export class Session {
  readonly mode: Mode;
  readonly level: LevelDef | null;
  readonly opts: SessionOptions;
  world: World;
  budget: number;
  readonly startBudget: number;
  spent = 0;
  status: Status = 'playing';
  /** why the run ended: extinction species, or failed goal */
  endReason: { kind: 'extinct'; species: Species; day: number } | { kind: 'goal' } | null = null;
  negativeEvents = 0;
  private snaps: Snap[] = [];

  constructor(opts: SessionOptions) {
    this.opts = opts;
    this.mode = opts.mode;
    this.level = opts.level ?? null;
    const L = this.level;
    this.world = new World({
      seed: L ? L.seed : opts.seed ?? 1,
      map: L ? L.map : opts.map ?? 'forest',
      cfg: opts.cfg ?? cloneConfig(),
      rabbits: L ? L.rabbits : 60,
      wolves: L ? L.wolves : 6,
      initialPlant: L?.initialPlant,
      seasons: L ? L.seasons : !!opts.seasons,
      weather: L ? L.weather : !!opts.weather,
      randomEvents: L ? L.randomEvents : !!opts.randomEvents,
      scheduledEvents: L ? L.scheduled : [],
    });
    this.startBudget = this.mode === 'sandbox' ? Infinity : L!.budget;
    this.budget = this.startBudget;
    this.pushSnap();
  }

  get unlimited(): boolean {
    return this.budget === Infinity;
  }

  /** advance one tick; returns the simulation events of that tick */
  step(): SimEvent[] {
    const w = this.world;
    w.step();
    const events = w.drainEvents();
    for (const e of events) {
      if (e.type === 'newDay') this.onNewDay();
      else if (e.type === 'eventStart') this.negativeEvents++;
      else if (e.type === 'extinct' && this.status === 'playing') {
        this.status = 'lost';
        this.endReason = { kind: 'extinct', species: e.species, day: e.day };
      }
    }
    return events;
  }

  private onNewDay(): void {
    const w = this.world;
    if (!this.unlimited) {
      const score = w.history.days.at(-1)?.shannon ?? 0;
      if (score >= ECONOMY.incomeMinScore) this.budget += (ECONOMY.incomePerDay * score) / 100;
    }
    this.pushSnap();
    this.checkGoal();
  }

  private pushSnap(): void {
    this.snaps.push({ day: this.world.day, world: this.world.serialize(), budget: this.budget, spent: this.spent });
    if (this.snaps.length > 16) this.snaps.shift();
  }

  canRewind(days = 10): boolean {
    return this.snaps.some((s) => s.day <= this.world.day - days);
  }

  /** go back ≥ `days` days (to the newest snapshot that old) */
  rewind(days = 10): boolean {
    const target = this.world.day - days;
    let pick: Snap | undefined;
    for (const s of this.snaps) if (s.day <= target) pick = s;
    if (!pick) return false;
    this.world.restore(pick.world);
    this.budget = pick.budget;
    this.spent = pick.spent;
    this.snaps = this.snaps.filter((s) => s.day <= pick!.day);
    this.status = 'playing';
    this.endReason = null;
    return true;
  }

  /** keep playing after a collapse (sandbox / curiosity) */
  continueAnyway(): void {
    this.status = 'playing';
    this.endReason = null;
  }

  // ───────────────────────── goals & stars ─────────────────────────

  goalDays(): number {
    return this.level ? this.level.goal.days : Infinity;
  }

  private allAlive(): boolean {
    const w = this.world;
    return w.counts[0] > 0 && w.counts[1] > 0;
  }

  private checkGoal(): void {
    if (!this.level || this.status !== 'playing') return;
    const g = this.level.goal;
    const w = this.world;
    if (w.day < g.days) return;
    let ok = this.allAlive();
    if (ok && g.kind === 'recover') ok = this.recentCover(15) >= g.minCover;
    if (ok && g.kind === 'stable') ok = this.rabbitCv() <= g.maxCv;
    this.status = ok ? 'won' : 'lost';
    if (!ok) this.endReason = { kind: 'goal' };
  }

  recentCover(days: number): number {
    const d = this.world.history.days.slice(-days);
    if (!d.length) return this.world.plantCover();
    return d.reduce((a, x) => a + x.plantCover, 0) / d.length;
  }

  rabbitCv(fromDay = 20): number {
    const xs = this.world.history.days.filter((d) => d.day >= fromDay).map((d) => d.rabbits);
    return meanCv(xs).cv;
  }

  meanDiversity(): number {
    const d = this.world.history.days;
    if (!d.length) return this.world.diversity();
    return d.reduce((a, x) => a + x.shannon, 0) / d.length;
  }

  stars(): number {
    if (!this.level || this.status !== 'won') return 0;
    let s = 1;
    if (this.meanDiversity() >= this.level.stars.diversity) s++;
    if (this.spent <= this.startBudget * this.level.stars.budgetFrac) s++;
    return s;
  }

  // ───────────────────────── player actions ─────────────────────────

  private pay(cost: number): boolean {
    if (this.unlimited) {
      this.spent += cost;
      return true;
    }
    if (this.budget + 1e-9 < cost) return false;
    this.budget -= cost;
    this.spent += cost;
    return true;
  }

  canAfford(cost: number): boolean {
    return this.unlimited || this.budget + 1e-9 >= cost;
  }

  apply(tool: Tool, x: number, y: number, brush: number): PlaceResult {
    const w = this.world;
    if (tool === 'rabbit' || tool === 'wolf') {
      const sp = tool === 'rabbit' ? Species.Rabbit : Species.Wolf;
      const cost = tool === 'rabbit' ? ECONOMY.rabbitCost : ECONOMY.wolfCost;
      if (!w.grid.walkableAt(x, y)) return { ok: false, count: 0, reason: 'blocked' };
      if (w.totalAnimals() >= w.cfg.maxAnimals) return { ok: false, count: 0, reason: 'cap' };
      if (!this.canAfford(cost)) return { ok: false, count: 0, reason: 'budget' };
      const i = w.placeAnimal(sp, x, y);
      if (i < 0) return { ok: false, count: 0, reason: 'blocked' };
      this.pay(cost);
      return { ok: true, count: 1 };
    }
    if (tool === 'plant') {
      // count first so we can charge exactly
      const probe = this.countPaintable(x, y, brush);
      if (probe === 0) return { ok: false, count: 0, reason: 'blocked' };
      const cost = probe * ECONOMY.plantTileCost;
      if (!this.canAfford(cost)) return { ok: false, count: 0, reason: 'budget' };
      const n = w.paintPlants(x, y, brush);
      this.pay(n * ECONOMY.plantTileCost);
      return { ok: true, count: n };
    }
    if (tool === 'remove') {
      const n = w.removeAnimals(x, y, brush);
      return { ok: n > 0, count: n };
    }
    return { ok: false, count: 0 };
  }

  private countPaintable(cx: number, cy: number, r: number): number {
    const g = this.world.grid;
    let n = 0;
    const rr = Math.max(0.5, r);
    for (let y = Math.floor(cy - rr); y <= Math.ceil(cy + rr); y++) {
      for (let x = Math.floor(cx - rr); x <= Math.ceil(cx + rr); x++) {
        if (!g.inBounds(x, y)) continue;
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > rr * rr) continue;
        const i = g.idx(x, y);
        if (g.canGrow(i) && g.plant[i]! < 99) n++;
      }
    }
    return n;
  }
}
