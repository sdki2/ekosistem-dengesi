import { cloneConfig, type SimConfig } from '../config';
import { AgentStore, AState, Species, type AgentSnapshot, type DeathCause } from './agents';
import { updateDeer, updateRabbit, updateWolf } from './behaviors';
import { Grid, Tile, type MapKind } from './grid';
import { generateMap } from './mapgen';
import { Rng } from './rng';
import { SpatialHash } from './spatialHash';
import { WeatherState, Wx } from './weather';
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
  | { type: 'weather'; kind: Wx }
  | { type: 'lightning'; x: number; y: number }
  | { type: 'flood'; rising: boolean }
  | { type: 'newDay'; day: number };

export interface WorldOptions {
  seed: number;
  map: MapKind;
  cfg?: SimConfig;
  rabbits: number;
  wolves: number;
  /** optional deer herd */
  deer?: number;
  /** initial plant range per tile, % */
  initialPlant?: [number, number];
  seasons?: boolean;
  weather?: boolean;
  randomEvents?: boolean;
  scheduledEvents?: ScheduledEvent[];
}

export interface WorldSnapshot {
  tick: number;
  rng: number;
  plant: Float32Array;
  agents: AgentSnapshot;
  activeEvent: ActiveEvent | null;
  weather: { kind: Wx; until: number; moisture: number; water: number; next: Wx; rng: number; tiles: Uint8Array };
  lastEventDay: number;
  extinct: number[];
  everPresent: boolean[];
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
  readonly deerHash: SpatialHash;
  tick = 0;
  seasonsEnabled: boolean;
  randomEvents: boolean;
  scheduled: ScheduledEvent[];
  activeEvent: ActiveEvent | null = null;
  lastEventDay = -1000;
  /** day each species went extinct (-1 = alive) */
  extinct: number[] = [-1, -1, -1];
  /** species that existed at some point (extinction only counts after presence) */
  everPresent: boolean[] = [false, false, false];
  counts: number[] = [0, 0, 0];
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
  visionMul = 1;
  thirstMul = 1;
  scentMul = 1;
  /** storm: animals take cover */
  sheltering = false;
  /** hot midday rest */
  siesta = false;
  /** dawn / dusk */
  twilight = false;

  weatherEnabled: boolean;
  readonly wx: WeatherState;

  constructor(opts: WorldOptions) {
    this.cfg = opts.cfg ? cloneConfig(opts.cfg) : cloneConfig();
    this.seed = opts.seed;
    this.mapKind = opts.map;
    this.rng = new Rng(opts.seed);
    this.grid = generateMap(this.cfg, opts.map, opts.seed, opts.initialPlant);
    this.agents = new AgentStore(2048);
    this.rabbitHash = new SpatialHash(this.cfg.width, this.cfg.height, 4);
    this.wolfHash = new SpatialHash(this.cfg.width, this.cfg.height, 4);
    this.deerHash = new SpatialHash(this.cfg.width, this.cfg.height, 4);
    this.seasonsEnabled = !!opts.seasons;
    this.weatherEnabled = !!opts.weather;
    this.wx = new WeatherState(opts.seed, this.cfg.weather.moistureStart);
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
    // deer drawn last so rabbit/wolf starting positions are unchanged
    for (let k = 0; k < (opts.deer ?? 0); k++) {
      const p = this.randomWalkable();
      this.spawnAnimal(Species.Deer, p[0], p[1], true);
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
    if (this.weatherEnabled) m *= (this.cfg.weather.moistureBase + this.cfg.weather.moistureGain * this.wx.moisture) * this.wx.effect.regrow;
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
    return this.counts[0] + this.counts[1] + this.counts[2]!;
  }

  speciesCfg(sp: Species): SimConfig['rabbit'] | SimConfig['wolf'] | SimConfig['deer'] {
    return sp === Species.Rabbit ? this.cfg.rabbit : sp === Species.Wolf ? this.cfg.wolf : this.cfg.deer;
  }

  /**
   * Create an animal. `initial` animals get a random age/energy so the
   * starting population is not perfectly synchronised.
   */
  spawnAnimal(species: Species, x: number, y: number, initial = false, energy?: number): number {
    if (this.totalAnimals() >= this.cfg.maxAnimals) return -1;
    if (!this.grid.walkableAt(x, y)) return -1;
    const a = this.agents;
    const sc = this.speciesCfg(species);
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
    if (sp !== Species.Deer) (sp === Species.Rabbit ? this.today.rabbitDeaths : this.today.wolfDeaths)[cause]++;
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
    if (this.counts[2]! > 0) this.deerHash.build(a, Species.Deer);

    this.night = this.dayFrac >= 1 - cfg.nightFraction;
    this.metabolismMul = this.activeEvent?.kind === 'winter' ? cfg.events.winterMetabolismMul : 1;
    if (this.season() === 3) this.metabolismMul *= 1.1;
    if (this.weatherEnabled) {
      const ev = this.activeEvent?.kind;
      const changed = this.wx.step(this.tick, this.season(), cfg.weather.minTicks, cfg.weather.maxTicks, ev === 'drought' || ev === 'winter' ? ev : null);
      if (changed !== null) this.emit({ type: 'weather', kind: changed });
      const fx = this.wx.effect;
      this.metabolismMul *= fx.metabolism;
      this.visionMul = fx.vision;
      this.thirstMul = fx.thirst;
      this.scentMul = fx.scent;
      this.sheltering = this.wx.kind === Wx.Storm;
      this.stormTick();
      if (this.tick % 10 === 0) this.applyWaterLevel();
    } else {
      this.visionMul = this.thirstMul = this.scentMul = 1;
      this.sheltering = false;
    }
    const f = this.dayFrac;
    const hot = this.weatherEnabled ? this.wx.kind === Wx.Heat : this.season() === 1;
    this.siesta = hot && f >= cfg.time.siestaFrom && f < cfg.time.siestaTo;
    this.twilight = f < 0.08 || (f >= 0.56 && f < 0.74);

    this.regrowPlants();

    const hi = a.hi;
    for (let i = 0; i < hi; i++) {
      if (!a.alive[i]) continue;
      const sp = a.species[i];
      if (sp === Species.Rabbit) updateRabbit(this, i);
      else if (sp === Species.Wolf) updateWolf(this, i);
      else updateDeer(this, i);
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

  /** lightning in storms: scorches plants and can kill an animal caught in the open */
  private stormTick(): void {
    if (this.wx.kind !== Wx.Storm || !this.wx.rng.chance(this.cfg.weather.lightningChance)) return;
    const g = this.grid;
    const x = this.wx.rng.range(1, g.w - 1);
    const y = this.wx.rng.range(1, g.h - 1);
    const R = this.cfg.weather.lightningRadius;
    for (let ty = Math.floor(y - R); ty <= Math.ceil(y + R); ty++) {
      for (let tx = Math.floor(x - R); tx <= Math.ceil(x + R); tx++) {
        if (!g.inBounds(tx, ty)) continue;
        if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) > R) continue;
        const i = g.idx(tx, ty);
        if (g.canGrow(i)) g.plant[i] = 0;
      }
    }
    const a = this.agents;
    for (let i = 0; i < a.hi; i++) {
      if (a.alive[i] && Math.hypot(a.x[i]! - x, a.y[i]! - y) < 0.9 && !g.isCover(a.x[i]!, a.y[i]!)) this.kill(i, 'weather');
    }
    this.emit({ type: 'lightning', x, y });
  }

  /** rivers and ponds shrink in dry spells and refill in wet ones */
  private applyWaterLevel(): void {
    const g = this.grid;
    const level = this.wx.water;
    const dry = this.cfg.weather.dryRank;
    let changed = 0;
    let rising = false;
    for (let i = 0; i < g.tiles.length; i++) {
      const r = g.shoreRank[i]!;
      if (r === 0 || r > 3) continue;
      const th = dry[r - 1]!;
      const t = g.tiles[i]!;
      if (t === Tile.Water && level < th) {
        g.tiles[i] = Tile.Ford;
        changed++;
      } else if (t === Tile.Ford && level > th + 0.04) {
        g.tiles[i] = Tile.Water;
        changed++;
        rising = true;
      }
    }
    if (!changed) return;
    g.finalize(this.cfg, this.mapKind);
    g.waterVersion++;
    if (rising) this.floodRescue();
    this.emit({ type: 'flood', rising });
  }

  /** animals standing on newly flooded tiles are moved to the nearest dry land */
  private floodRescue(): void {
    const a = this.agents;
    const g = this.grid;
    for (let i = 0; i < a.hi; i++) {
      if (!a.alive[i] || g.walkableAt(a.x[i]!, a.y[i]!)) continue;
      let done = false;
      for (let r = 1; r <= 5 && !done; r++) {
        for (let k = 0; k < 16; k++) {
          const ang = (k / 16) * Math.PI * 2;
          const nx = a.x[i]! + Math.cos(ang) * r;
          const ny = a.y[i]! + Math.sin(ang) * r;
          if (g.walkableAt(nx, ny)) {
            a.x[i] = a.px[i] = nx;
            a.y[i] = a.py[i] = ny;
            done = true;
            break;
          }
        }
      }
      if (!done) this.kill(i, 'weather');
    }
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
    h.deer.push(this.counts[2]!);
    h.shannon.push(this.diversity());
  }

  private endOfDay(): void {
    const day = this.day - 1;
    const log: DayLog = {
      day,
      plantCover: this.plantCover(),
      rabbits: this.counts[0],
      wolves: this.counts[1],
      deer: this.counts[2]!,
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
      const sc = this.speciesCfg(species);
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
      weather: { kind: this.wx.kind, until: this.wx.until, moisture: this.wx.moisture, water: this.wx.water, next: this.wx.next, rng: this.wx.rng.state, tiles: this.grid.tiles.slice() },
      lastEventDay: this.lastEventDay,
      extinct: this.extinct.slice(),
      everPresent: this.everPresent.slice(),
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
    this.wx.kind = s.weather.kind;
    this.wx.until = s.weather.until;
    this.wx.moisture = s.weather.moisture;
    this.wx.water = s.weather.water;
    this.wx.next = s.weather.next;
    if (s.weather.tiles.some((v, i) => v !== this.grid.tiles[i])) {
      this.grid.tiles.set(s.weather.tiles);
      this.grid.finalize(this.cfg, this.mapKind);
      this.grid.waterVersion++;
    }
    this.wx.rng.state = s.weather.rng;
    this.extinct = s.extinct.slice();
    this.everPresent = s.everPresent.slice();
    this.today = JSON.parse(JSON.stringify(s.today)) as DayCounters;
    const h = this.history;
    h.t.length = h.plants.length = h.rabbits.length = h.wolves.length = h.deer.length = h.shannon.length = s.historyLen;
    h.days.length = s.daysLen;
    this.counts = [0, 0, 0];
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
    mix(this.counts[2]!);
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

export { AState, Species, Wx };
