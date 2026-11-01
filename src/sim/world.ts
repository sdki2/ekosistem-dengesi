import { cloneConfig, type SimConfig } from '../config';
import { AgentStore, AState, Species, type AgentSnapshot, type DeathCause } from './agents';
import { updateRabbit, updateWolf } from './behaviors';
import { Grid, type MapKind } from './grid';
import { generateMap } from './mapgen';
import { Rng } from './rng';
import { SpatialHash } from './spatialHash';
import { History, emptyDeaths, shannon, TILES_PER_PLANT_PATCH, type DayLog } from './stats';

export type EventKind = 'drought' | 'disease' | 'winter';

export interface ScheduledEvent {
  day: number;
  kind: EventKind;
  /** for disease: which species (default: random) */
  species?: Species;
}

export interface ActiveEvent {
  kind: EventKind;
  startDay: number;
  endDay: number;
}

export type SimEvent =
  | { type: 'birth'; species: Species; x: number; y: number }
  | { type: 'death'; species: Species; cause: DeathCause; x: number; y: number }
  | { type: 'eat'; x: number; y: number }
  | { type: 'catch'; x: number; y: number }
  | { type: 'flee'; x: number; y: number }
  | { type: 'extinct'; species: Species; day: number }
  | { type: 'eventStart'; kind: EventKind; species?: Species; killed?: number }
  | { type: 'eventEnd'; kind: EventKind }
  | { type: 'newDay'; day: number };

export interface WorldOptions {
  seed: number;
  map: MapKind;
  cfg?: SimConfig;
  rabbits: number;
  wolves: number;
  /** initial plant range per tile, % */
  initialPlant?: [number, number];
  seasons?: boolean;
  randomEvents?: boolean;
  scheduledEvents?: ScheduledEvent[];
}

export interface WorldSnapshot {
  tick: number;
  rng: number;
  plant: Float32Array;
  agents: AgentSnapshot;
  activeEvent: ActiveEvent | null;
  lastEventDay: number;
  extinct: [number, number];
  everPresent: [boolean, boolean];
  today: DayCounters;
  historyLen: number;
  daysLen: number;
}

interface DayCounters {
  rabbitBirths: number;
  wolfBirths: number;
  rabbitDeaths: Record<DeathCause, number>;
  wolfDeaths: Record<DeathCause, number>;
}

function newDayCounters(): DayCounters {
  return { rabbitBirths: 0, wolfBirths: 0, rabbitDeaths: emptyDeaths(), wolfDeaths: emptyDeaths() };
}

/** Pure simulation: no DOM, deterministic for a given seed + command sequence. */
export class World {
  cfg: SimConfig;
  readonly seed: number;
  readonly mapKind: MapKind;
  readonly grid: Grid;
  rng: Rng;
  agents: AgentStore;
  readonly rabbitHash: SpatialHash;
  readonly wolfHash: SpatialHash;
  tick = 0;
  seasonsEnabled: boolean;
  randomEvents: boolean;
  scheduled: ScheduledEvent[];
  activeEvent: ActiveEvent | null = null;
  lastEventDay = -1000;
  /** day each species went extinct (-1 = alive) */
  extinct: [number, number] = [-1, -1];
  /** species that existed at some point (extinction only counts after presence) */
  everPresent: [boolean, boolean] = [false, false];
  counts: [number, number] = [0, 0];
  history = new History();
  today: DayCounters = newDayCounters();
  /** sample the time series every N ticks */
  readonly sampleEvery = 5;

  /** event outbox, drained by the UI/renderer */
  events: SimEvent[] = [];
  private pendingBirths: { species: Species; x: number; y: number; energy: number }[] = [];

  // per-tick environment (read by behaviors)
  night = false;
  metabolismMul = 1;

  constructor(opts: WorldOptions) {
    this.cfg = opts.cfg ? cloneConfig(opts.cfg) : cloneConfig();
    this.seed = opts.seed;
    this.mapKind = opts.map;
    this.rng = new Rng(opts.seed);
    this.grid = generateMap(this.cfg, opts.map, opts.seed, opts.initialPlant);
    this.agents = new AgentStore(2048);
    this.rabbitHash = new SpatialHash(this.cfg.width, this.cfg.height, 4);
    this.wolfHash = new SpatialHash(this.cfg.width, this.cfg.height, 4);
    this.seasonsEnabled = !!opts.seasons;
    this.randomEvents = !!opts.randomEvents;
    this.scheduled = (opts.scheduledEvents ?? []).slice().sort((a, b) => a.day - b.day);

    for (let k = 0; k < opts.rabbits; k++) {
      const p = this.randomWalkable();
      this.spawnAnimal(Species.Rabbit, p[0], p[1], true);
    }
    // wolves start in one or two loose packs
    const packs = opts.wolves > 4 ? 2 : 1;
    const centers: [number, number][] = [];
    for (let k = 0; k < packs; k++) centers.push(this.randomWalkable());
    for (let k = 0; k < opts.wolves; k++) {
      const c = centers[k % packs]!;
      const p = this.randomWalkableNear(c[0], c[1], 3);
      this.spawnAnimal(Species.Wolf, p[0], p[1], true);
    }
    this.sample();
  }

  // ───────────────────────── time helpers ─────────────────────────

  get day(): number {
    return Math.floor(this.tick / this.cfg.ticksPerDay);
  }

  /** fraction of the current day 0–1 */
  get dayFrac(): number {
    return (this.tick % this.cfg.ticksPerDay) / this.cfg.ticksPerDay;
  }

  /** 0 spring, 1 summer, 2 autumn, 3 winter; -1 when seasons are off */
  season(): number {
    if (!this.seasonsEnabled) return -1;
    return Math.floor(this.day / this.cfg.seasons.lengthDays) % 4;
  }

  regrowMultiplier(): number {
    let m = this.cfg.plant.regrowMul;
    const s = this.season();
    if (s >= 0) m *= this.cfg.seasons.regrow[s as 0 | 1 | 2 | 3];
    const e = this.activeEvent;
    if (e?.kind === 'drought') m *= this.cfg.events.droughtRegrowMul;
    if (e?.kind === 'winter') m *= this.cfg.events.winterRegrowMul;
    return m;
  }

  // ───────────────────────── spawning / killing ─────────────────────────

  randomWalkable(): [number, number] {
    const g = this.grid;
    for (let tries = 0; tries < 1000; tries++) {
      const x = this.rng.range(0, g.w);
      const y = this.rng.range(0, g.h);
      if (g.walkableAt(x, y)) return [x, y];
    }
    return [g.w / 2, g.h / 2];
  }

  randomWalkableNear(cx: number, cy: number, r: number): [number, number] {
    for (let tries = 0; tries < 50; tries++) {
      const x = cx + this.rng.range(-r, r);
      const y = cy + this.rng.range(-r, r);
      if (this.grid.walkableAt(x, y)) return [x, y];
    }
    return [cx, cy];
  }

  totalAnimals(): number {
    return this.counts[0] + this.counts[1];
  }

  /**
   * Create an animal. `initial` animals get a random age/energy so the
   * starting population is not perfectly synchronised.
   */
  spawnAnimal(species: Species, x: number, y: number, initial = false, energy?: number): number {
    if (this.totalAnimals() >= this.cfg.maxAnimals) return -1;
    if (!this.grid.walkableAt(x, y)) return -1;
    const a = this.agents;
    const sc = species === Species.Rabbit ? this.cfg.rabbit : this.cfg.wolf;
    const tpd = this.cfg.ticksPerDay;
    const i = a.spawn();
    a.species[i] = species;
    a.x[i] = a.px[i] = x;
    a.y[i] = a.py[i] = y;
    const ang = this.rng.range(0, Math.PI * 2);
    a.hx[i] = Math.cos(ang);
    a.hy[i] = Math.sin(ang);
    a.tx[i] = x;
    a.ty[i] = y;
    a.maxAge[i] = sc.lifespanDays * tpd * this.rng.range(1 - sc.lifespanJitter, 1 + sc.lifespanJitter);
    if (initial) {
      a.age[i] = this.rng.range(0, sc.maturityDays * 2.5) * tpd;
      a.energy[i] = sc.maxEnergy * this.rng.range(0.55, 0.85);
      a.cooldown[i] = this.rng.range(0, sc.reproCooldownDays * tpd);
    } else {
      a.age[i] = 0;
      a.energy[i] = energy ?? sc.maxEnergy * 0.7;
      a.cooldown[i] = 0;
    }
    a.stamina[i] = species === Species.Rabbit ? this.cfg.rabbit.stamina : 0;
    a.bornTick[i] = this.tick;
    this.counts[species]++;
    this.everPresent[species] = true;
    this.extinct[species] = -1;
    return i;
  }

  kill(i: number, cause: DeathCause): void {
    const a = this.agents;
    if (!a.alive[i]) return;
    const sp = a.species[i] as Species;
    this.counts[sp]--;
    const log = sp === Species.Rabbit ? this.today.rabbitDeaths : this.today.wolfDeaths;
    log[cause]++;
    this.emit({ type: 'death', species: sp, cause, x: a.x[i]!, y: a.y[i]! });
    a.release(i);
  }

  queueBirth(species: Species, x: number, y: number, energy: number): void {
    this.pendingBirths.push({ species, x, y, energy });
  }

  emit(e: SimEvent): void {
    if (this.events.length < 4000) this.events.push(e);
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ───────────────────────── main step ─────────────────────────

  step(): void {
    const a = this.agents;
    const cfg = this.cfg;
    for (let i = 0; i < a.hi; i++) {
      a.px[i] = a.x[i]!;
      a.py[i] = a.y[i]!;
    }
    this.rabbitHash.build(a, Species.Rabbit);
    this.wolfHash.build(a, Species.Wolf);

    this.night = this.dayFrac >= 1 - cfg.nightFraction;
    this.metabolismMul = this.activeEvent?.kind === 'winter' ? cfg.events.winterMetabolismMul : 1;
    if (this.season() === 3) this.metabolismMul *= 1.1;

    this.regrowPlants();

    const hi = a.hi;
    for (let i = 0; i < hi; i++) {
      if (!a.alive[i]) continue;
      if (a.species[i] === Species.Rabbit) updateRabbit(this, i);
      else updateWolf(this, i);
    }

    // births
    for (const b of this.pendingBirths) {
      const [x, y] = this.randomWalkableNear(b.x, b.y, 0.6);
      const j = this.spawnAnimal(b.species, x, y, false, b.energy);
      if (j >= 0) {
        if (b.species === Species.Rabbit) this.today.rabbitBirths++;
        else this.today.wolfBirths++;
        this.emit({ type: 'birth', species: b.species, x, y });
      }
    }
    this.pendingBirths.length = 0;

    this.tick++;
    this.checkExtinction();
    if (this.tick % this.sampleEvery === 0) this.sample();
    if (this.tick % cfg.ticksPerDay === 0) this.endOfDay();
  }

  run(ticks: number): void {
    for (let k = 0; k < ticks; k++) this.step();
  }

  private regrowPlants(): void {
    const g = this.grid;
    const { rate, bareMul, minEdible } = this.cfg.plant;
    const m = this.regrowMultiplier();
    const plant = g.plant;
    const gm = g.growMul;
    for (let i = 0; i < plant.length; i++) {
      const mul = gm[i]!;
      if (mul === 0) continue;
      const p = plant[i]!;
      if (p >= 100) continue;
      const np = p + mul * m * rate * (p < minEdible ? bareMul : 1);
      plant[i] = np > 100 ? 100 : np;
    }
  }

  private checkExtinction(): void {
    for (const sp of [Species.Rabbit, Species.Wolf]) {
      if (this.counts[sp] === 0 && this.everPresent[sp] && this.extinct[sp] < 0) {
        this.extinct[sp] = this.day;
        this.emit({ type: 'extinct', species: sp, day: this.day });
      }
    }
  }

  // ───────────────────────── stats ─────────────────────────

  plantCover(): number {
    return this.grid.meanCover();
  }

  /** abundances used for the Shannon index: plant patches, rabbits, wolves */
  diversity(): number {
    const g = this.grid;
    let vegetated = 0;
    for (let i = 0; i < g.plant.length; i++) if (g.plant[i]! >= 20) vegetated++;
    return shannon([vegetated / TILES_PER_PLANT_PATCH, this.counts[0], this.counts[1]]).score;
  }

  private sample(): void {
    const h = this.history;
    h.t.push(this.tick / this.cfg.ticksPerDay);
    h.plants.push(this.plantCover());
    h.rabbits.push(this.counts[0]);
    h.wolves.push(this.counts[1]);
    h.shannon.push(this.diversity());
  }

  private endOfDay(): void {
    const day = this.day - 1;
    const log: DayLog = {
      day,
      plantCover: this.plantCover(),
      rabbits: this.counts[0],
      wolves: this.counts[1],
      rabbitBirths: this.today.rabbitBirths,
      wolfBirths: this.today.wolfBirths,
      rabbitDeaths: this.today.rabbitDeaths,
      wolfDeaths: this.today.wolfDeaths,
      shannon: this.diversity(),
    };
    this.history.days.push(log);
    this.today = newDayCounters();
    this.emit({ type: 'newDay', day: this.day });
    this.updateEvents();
  }

  // ───────────────────────── events ─────────────────────────

  private updateEvents(): void {
    const day = this.day;
    if (this.activeEvent && day >= this.activeEvent.endDay) {
      this.emit({ type: 'eventEnd', kind: this.activeEvent.kind });
      this.activeEvent = null;
    }
    while (this.scheduled.length && this.scheduled[0]!.day <= day) {
      const s = this.scheduled.shift()!;
      this.startEvent(s.kind, s.species);
    }
    if (this.randomEvents && !this.activeEvent && day - this.lastEventDay >= this.cfg.events.minGapDays && day > 10) {
      if (this.rng.chance(this.cfg.events.dailyChance)) {
        const kind = this.rng.pick<EventKind>(['drought', 'disease', 'winter']);
        this.startEvent(kind);
      }
    }
  }

  startEvent(kind: EventKind, species?: Species): void {
    const ev = this.cfg.events;
    const day = this.day;
    this.lastEventDay = day;
    if (kind === 'disease') {
      const sp = species ?? (this.rng.chance(0.6) ? Species.Rabbit : Species.Wolf);
      const frac = this.rng.range(ev.diseaseMin, ev.diseaseMax);
      const a = this.agents;
      let killed = 0;
      // never wipe a species out completely through disease
      const maxKill = Math.max(0, this.counts[sp] - 2);
      for (let i = 0; i < a.hi && killed < maxKill; i++) {
        if (a.alive[i] && a.species[i] === sp && this.rng.chance(frac)) {
          this.kill(i, 'disease');
          killed++;
        }
      }
      this.emit({ type: 'eventStart', kind, species: sp, killed });
      return;
    }
    if (this.activeEvent) this.emit({ type: 'eventEnd', kind: this.activeEvent.kind });
    const len = kind === 'drought' ? ev.droughtDays : ev.winterDays;
    this.activeEvent = { kind, startDay: day, endDay: day + len };
    this.emit({ type: 'eventStart', kind });
  }

  // ───────────────────────── player commands ─────────────────────────

  placeAnimal(species: Species, x: number, y: number): number {
    const i = this.spawnAnimal(species, x, y, false);
    if (i >= 0) {
      const sc = species === Species.Rabbit ? this.cfg.rabbit : this.cfg.wolf;
      // placed animals are young adults with decent energy
      this.agents.age[i] = sc.maturityDays * this.cfg.ticksPerDay * 1.1;
      this.agents.energy[i] = sc.maxEnergy * 0.75;
    }
    return i;
  }

  /** raise plant amount in a disc; returns number of tiles affected */
  paintPlants(cx: number, cy: number, radius: number, amount = 50): number {
    const g = this.grid;
    let n = 0;
    const r = Math.max(0.5, radius);
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (!g.inBounds(x, y)) continue;
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > r * r) continue;
        const i = g.idx(x, y);
        if (!g.canGrow(i) || g.plant[i]! >= 99) continue;
        g.plant[i] = Math.min(100, g.plant[i]! + amount);
        n++;
      }
    }
    return n;
  }

  /** remove animals in a disc; returns how many */
  removeAnimals(cx: number, cy: number, radius: number): number {
    const a = this.agents;
    let n = 0;
    const r2 = radius * radius;
    for (let i = 0; i < a.hi; i++) {
      if (!a.alive[i]) continue;
      const dx = a.x[i]! - cx;
      const dy = a.y[i]! - cy;
      if (dx * dx + dy * dy <= r2) {
        this.kill(i, 'removed');
        n++;
      }
    }
    return n;
  }

  /** nearest animal to a point (slot) or -1 */
  animalAt(x: number, y: number, r = 0.8): number {
    const a = this.agents;
    let best = -1;
    let bd = r * r;
    for (let i = 0; i < a.hi; i++) {
      if (!a.alive[i]) continue;
      const dx = a.x[i]! - x;
      const dy = a.y[i]! - y;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  // ───────────────────────── snapshots ─────────────────────────

  serialize(): WorldSnapshot {
    return {
      tick: this.tick,
      rng: this.rng.state,
      plant: this.grid.plant.slice(),
      agents: this.agents.serialize(),
      activeEvent: this.activeEvent ? { ...this.activeEvent } : null,
      lastEventDay: this.lastEventDay,
      extinct: [this.extinct[0], this.extinct[1]],
      everPresent: [this.everPresent[0], this.everPresent[1]],
      today: JSON.parse(JSON.stringify(this.today)) as DayCounters,
      historyLen: this.history.t.length,
      daysLen: this.history.days.length,
    };
  }

  restore(s: WorldSnapshot): void {
    this.tick = s.tick;
    this.rng.state = s.rng;
    this.grid.plant.set(s.plant);
    this.agents = AgentStore.deserialize(s.agents);
    this.activeEvent = s.activeEvent ? { ...s.activeEvent } : null;
    this.lastEventDay = s.lastEventDay;
    this.extinct = [s.extinct[0], s.extinct[1]];
    this.everPresent = [s.everPresent[0], s.everPresent[1]];
    this.today = JSON.parse(JSON.stringify(s.today)) as DayCounters;
    const h = this.history;
    h.t.length = h.plants.length = h.rabbits.length = h.wolves.length = h.shannon.length = s.historyLen;
    h.days.length = s.daysLen;
    this.counts = [0, 0];
    const a = this.agents;
    for (let i = 0; i < a.hi; i++) if (a.alive[i]) this.counts[a.species[i] as Species]++;
    this.events = [];
    this.pendingBirths = [];
  }

  /** cheap state hash for determinism tests */
  hash(): number {
    let h = 2166136261 >>> 0;
    const mix = (v: number) => {
      h ^= Math.round(v * 1000) | 0;
      h = Math.imul(h, 16777619) >>> 0;
    };
    mix(this.tick);
    mix(this.counts[0]);
    mix(this.counts[1]);
    const a = this.agents;
    for (let i = 0; i < a.hi; i++) {
      if (!a.alive[i]) continue;
      mix(a.x[i]!);
      mix(a.y[i]!);
      mix(a.energy[i]!);
    }
    for (let i = 0; i < this.grid.plant.length; i += 7) mix(this.grid.plant[i]!);
    return h;
  }
}

export { AState, Species };
