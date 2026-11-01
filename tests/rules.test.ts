import { describe, expect, it } from 'vitest';
import { Species } from '../src/sim/agents';
import { Tile } from '../src/sim/grid';
import { World } from '../src/sim/world';
import { withOverrides, type DeepPartial } from './balance/harness';
import type { SimConfig } from '../src/config';

/** a forest world turned into open grass with a set plant amount */
function flatWorld(plant = 100, over: DeepPartial<SimConfig> = {}): World {
  const w = new World({ seed: 1, map: 'forest', rabbits: 0, wolves: 0, cfg: withOverrides(over) });
  w.grid.tiles.fill(Tile.Grass);
  w.grid.growMul.fill(1);
  w.grid.plant.fill(plant);
  return w;
}

describe('rabbit rules', () => {
  it('loses energy every tick when there is no food', () => {
    const w = flatWorld(0, { plant: { rate: 0 } });
    const i = w.placeAnimal(Species.Rabbit, 10.5, 10.5);
    const e0 = w.agents.energy[i]!;
    w.step();
    expect(w.agents.energy[i]!).toBeLessThan(e0);
  });

  it('eats: plant on its tile goes down and energy goes up', () => {
    const w = flatWorld(100);
    const i = w.placeAnimal(Species.Rabbit, 10.5, 10.5);
    w.agents.energy[i] = 40;
    w.agents.cooldown[i] = 9999;
    w.step();
    expect(w.grid.plant[w.grid.idx(10, 10)]!).toBeLessThan(100);
    expect(w.agents.energy[i]!).toBeGreaterThan(40);
  });

  it('starves to death at energy 0', () => {
    const w = flatWorld(0, { plant: { rate: 0 } });
    const i = w.placeAnimal(Species.Rabbit, 10.5, 10.5);
    w.agents.energy[i] = 0.1;
    w.step();
    expect(w.counts[Species.Rabbit]).toBe(0);
    expect(w.today.rabbitDeaths.starved).toBe(1);
  });

  it('dies of old age', () => {
    const w = flatWorld(100);
    const i = w.placeAnimal(Species.Rabbit, 10.5, 10.5);
    w.agents.age[i] = w.agents.maxAge[i]!;
    w.step();
    expect(w.today.rabbitDeaths.old).toBe(1);
  });

  it('reproduces when mature, fed and off cooldown, splitting energy', () => {
    const w = flatWorld(100);
    const i = w.placeAnimal(Species.Rabbit, 10.5, 10.5);
    w.agents.energy[i] = 100;
    w.agents.cooldown[i] = 0;
    w.step();
    expect(w.counts[Species.Rabbit]).toBeGreaterThan(1);
    expect(w.agents.energy[i]!).toBeLessThan(100);
    expect(w.agents.cooldown[i]!).toBeGreaterThan(0);
  });

  it('does not reproduce before maturity', () => {
    const w = flatWorld(100);
    const i = w.placeAnimal(Species.Rabbit, 10.5, 10.5);
    w.agents.age[i] = 0;
    w.agents.energy[i] = 100;
    w.agents.cooldown[i] = 0;
    w.step();
    expect(w.counts[Species.Rabbit]).toBe(1);
  });

  it('flees from a nearby wolf', () => {
    const w = flatWorld(100);
    const r = w.placeAnimal(Species.Rabbit, 20.5, 20.5);
    const f = w.placeAnimal(Species.Wolf, 18.5, 20.5);
    w.agents.energy[f] = w.cfg.wolf.maxEnergy; // full, so it does not chase
    const x0 = w.agents.x[r]!;
    w.step();
    expect(w.agents.x[r]!).toBeGreaterThan(x0);
  });
});

describe('wolf rules', () => {
  it('a hungry wolf catches an adjacent rabbit and gains energy', () => {
    const w = flatWorld(100, { wolf: { catchChance: 1 } });
    w.placeAnimal(Species.Rabbit, 20.5, 20.5);
    const f = w.placeAnimal(Species.Wolf, 20.2, 20.5);
    w.agents.energy[f] = 30;
    w.step();
    expect(w.counts[Species.Rabbit]).toBe(0);
    expect(w.today.rabbitDeaths.eaten).toBe(1);
    expect(w.agents.energy[f]!).toBeGreaterThan(30);
    expect(w.agents.rest[f]!).toBeGreaterThan(0);
  });

  it('a full wolf does not hunt (satiation)', () => {
    const w = flatWorld(100, { wolf: { catchChance: 1 } });
    w.placeAnimal(Species.Rabbit, 20.5, 20.5);
    const f = w.placeAnimal(Species.Wolf, 20.2, 20.5);
    w.agents.energy[f] = w.cfg.wolf.maxEnergy;
    w.agents.cooldown[f] = 9999;
    w.step();
    expect(w.counts[Species.Rabbit]).toBe(1);
  });

  it('wolves starve without prey', () => {
    const w = flatWorld(100);
    w.placeAnimal(Species.Wolf, 20.5, 20.5);
    w.run(w.cfg.ticksPerDay * 60);
    expect(w.counts[Species.Wolf]).toBe(0);
    expect(w.extinct[Species.Wolf]).toBeGreaterThanOrEqual(0);
  });
});

describe('plants', () => {
  it('regrow toward 100 and never exceed it', () => {
    const w = flatWorld(0);
    w.run(20 * 200);
    let max = 0;
    for (const p of w.grid.plant) max = Math.max(max, p);
    expect(max).toBeLessThanOrEqual(100);
    expect(w.plantCover()).toBeGreaterThan(90);
  });

  it('regrow slower on shaded tiles and faster next to water', () => {
    const forest = new World({ seed: 3, map: 'forest', rabbits: 0, wolves: 0 });
    const g = forest.grid;
    let shaded = -1;
    let open = -1;
    for (let i = 0; i < g.tiles.length; i++) {
      if (g.tiles[i] !== Tile.Grass) continue;
      if (g.growMul[i]! < 1 && shaded < 0) shaded = i;
      if (g.growMul[i] === 1 && open < 0) open = i;
    }
    expect(shaded).toBeGreaterThanOrEqual(0);
    expect(g.growMul[shaded]!).toBeLessThan(g.growMul[open]!);

    const river = new World({ seed: 3, map: 'river', rabbits: 0, wolves: 0 });
    const rg = river.grid;
    let near = 0;
    let far = 0;
    for (let i = 0; i < rg.tiles.length; i++) {
      if (rg.tiles[i] !== Tile.Grass) continue;
      if (rg.waterDist[i] === 1) near = Math.max(near, rg.growMul[i]!);
      if (rg.waterDist[i]! > 8 && rg.waterDist[i]! < 255) far = Math.max(far, rg.growMul[i]!);
    }
    expect(near).toBeCloseTo(river.cfg.plant.nearWaterMul, 5);
    expect(far).toBeCloseTo(river.cfg.plant.farWaterMul, 5);
  });

  it('season and drought change the regrowth multiplier', () => {
    const w = new World({ seed: 1, map: 'forest', rabbits: 0, wolves: 0, seasons: true });
    const spring = w.regrowMultiplier();
    expect(spring).toBeCloseTo(w.cfg.plant.regrowMul * w.cfg.seasons.regrow[0], 6);
    w.startEvent('drought');
    expect(w.regrowMultiplier()).toBeCloseTo(spring * w.cfg.events.droughtRegrowMul, 6);
  });
});

describe('determinism & snapshots', () => {
  it('same seed gives the same state', () => {
    const a = new World({ seed: 5, map: 'river', rabbits: 60, wolves: 6 });
    const b = new World({ seed: 5, map: 'river', rabbits: 60, wolves: 6 });
    a.run(20 * 30);
    b.run(20 * 30);
    expect(a.hash()).toBe(b.hash());
  });

  it('restoring a snapshot replays identically', () => {
    const w = new World({ seed: 9, map: 'forest', rabbits: 60, wolves: 6 });
    w.run(20 * 10);
    const snap = w.serialize();
    w.run(20 * 10);
    const h1 = w.hash();
    w.restore(snap);
    expect(w.day).toBe(10);
    w.run(20 * 10);
    expect(w.hash()).toBe(h1);
  });

  it('records extinction once', () => {
    const w = new World({ seed: 2, map: 'forest', rabbits: 5, wolves: 0 });
    w.removeAnimals(32, 20, 100);
    w.step();
    const ev = w.drainEvents().filter((e) => e.type === 'extinct');
    expect(ev.length).toBe(1);
  });
});
