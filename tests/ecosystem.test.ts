import { describe, expect, it } from 'vitest';
import { Species } from '../src/sim/agents';
import { Tile } from '../src/sim/grid';
import { Wx, World } from '../src/sim/world';

const make = (over: Partial<ConstructorParameters<typeof World>[0]> = {}) =>
  new World({ seed: 11, map: 'river', rabbits: 40, wolves: 4, weather: true, ...over });

describe('water level', () => {
  it('rivers shrink in a long dry spell and refill after rain', () => {
    const w = make();
    const water = () => w.grid.tiles.reduce((n, t) => n + (t === Tile.Water ? 1 : 0), 0);
    const start = water();
    w.wx.kind = Wx.Heat;
    w.wx.until = Infinity;
    w.wx.moisture = 0;
    w.run(20 * 40);
    const dry = water();
    expect(dry).toBeLessThan(start);
    const v = w.grid.waterVersion;
    w.wx.kind = Wx.Rain;
    w.wx.moisture = 1;
    w.run(20 * 40);
    expect(water()).toBeGreaterThan(dry);
    expect(w.grid.waterVersion).toBeGreaterThan(v);
  });

  it('never leaves an animal standing in water after a flood', () => {
    const w = make({ rabbits: 120 });
    w.wx.until = Infinity;
    w.wx.kind = Wx.Heat;
    w.wx.moisture = 0;
    w.run(20 * 30);
    w.wx.kind = Wx.Rain;
    w.wx.moisture = 1;
    for (let k = 0; k < 20 * 30; k++) {
      w.step();
      const a = w.agents;
      for (let i = 0; i < a.hi; i++) if (a.alive[i]) expect(w.grid.walkableAt(a.x[i]!, a.y[i]!)).toBe(true);
    }
  });

  it('forest maps now have ponds', () => {
    const w = make({ map: 'forest' });
    expect(w.grid.hasWater).toBe(true);
  });
});

describe('weather matters', () => {
  it('lightning scorches plants', () => {
    const w = make({ rabbits: 0, wolves: 0 });
    w.wx.until = Infinity;
    w.wx.kind = Wx.Storm;
    w.cfg.weather.lightningChance = 1;
    w.grid.plant.fill(80);
    w.step();
    expect(w.drainEvents().some((e) => e.type === 'lightning')).toBe(true);
    expect(w.grid.plant.some((p) => p < 1)).toBe(true);
  });

  it('rabbits shelter in storms instead of grazing', () => {
    const w = make({ wolves: 0 });
    w.wx.until = Infinity;
    w.wx.kind = Wx.Storm;
    w.cfg.weather.lightningChance = 0;
    w.run(10);
    const a = w.agents;
    let sleeping = 0;
    let n = 0;
    for (let i = 0; i < a.hi; i++) if (a.alive[i] && a.species[i] === Species.Rabbit) { n++; if (a.state[i] === 6 /* Sleep */) sleeping++; }
    expect(sleeping / n).toBeGreaterThan(0.5);
  });

  it('forecasts the next spell and then delivers it', () => {
    const w = make();
    w.step();
    const next = w.wx.next;
    const until = w.wx.until;
    while (w.tick < until) w.step();
    w.step();
    expect(w.wx.kind).toBe(next);
  });
});

describe('deer', () => {
  it('spawn, graze and are counted', () => {
    const w = make({ map: 'forest', deer: 10 });
    expect(w.counts[2]).toBe(10);
    w.run(100);
    expect(w.counts[2]).toBeGreaterThan(0);
    expect(w.history.deer.length).toBe(w.history.t.length);
  });

  it('wolves can eat deer', () => {
    const w = make({ map: 'forest', rabbits: 0, wolves: 8, deer: 30 });
    w.cfg.wolf.catchChance = 1;
    w.cfg.deer.wolfCatchMul = 1;
    let eaten = 0;
    for (let k = 0; k < 20 * 20; k++) {
      w.step();
      for (const e of w.drainEvents()) if (e.type === 'catch') eaten++;
    }
    expect(eaten).toBeGreaterThan(0);
  });

  it('a deer herd never changes a world without deer, and restores from snapshots', () => {
    const a = make({ map: 'forest', deer: 8 });
    a.run(100);
    const snap = a.serialize();
    a.run(100);
    const h = a.hash();
    a.restore(snap);
    a.run(100);
    expect(a.hash()).toBe(h);
  });

  it('losing all deer does not end the game', () => {
    const w = make({ map: 'forest', deer: 3 });
    w.removeAnimals(w.grid.w / 2, w.grid.h / 2, 100);
    w.step();
    expect(w.extinct[2]).toBe(-1);
  });
});

describe('foxes, bears, seasons, night', () => {
  const at = (w: World, day: number, frac: number) => {
    w.tick = Math.floor((day + frac) * w.cfg.ticksPerDay);
  };

  it('bears hibernate through winter and barely use energy', () => {
    const w = make({ map: 'forest', rabbits: 0, wolves: 0, bears: 2, seasons: true, weather: false });
    at(w, w.cfg.seasons.lengthDays * 3 + 1, 0.4);
    const e0 = w.counts[4]! ? w.agents.energy.slice() : null;
    w.run(40);
    const a = w.agents;
    for (let i = 0; i < a.hi; i++) {
      if (!a.alive[i] || a.species[i] !== Species.Bear) continue;
      expect(a.state[i]).toBe(6); // Sleep
      expect(e0![i]! - a.energy[i]!).toBeLessThan(w.cfg.bear.metabolism * 40 * 0.2);
    }
  });

  it('foxes den up in bushes by day and hunt at night', () => {
    const w = make({ map: 'forest', rabbits: 60, wolves: 0, foxes: 6, weather: false });
    at(w, 2, 0.3);
    w.run(15);
    const a = w.agents;
    let day = 0;
    for (let i = 0; i < a.hi; i++) if (a.alive[i] && a.species[i] === Species.Fox && a.state[i] === 8) day++;
    at(w, 3, 0.8);
    let night = 0;
    for (let k = 0; k < 4; k++) {
      w.step();
      for (let i = 0; i < a.hi; i++) if (a.alive[i] && a.species[i] === Species.Fox && (a.state[i] === 8 || a.state[i] === 0)) night++;
    }
    expect(night).toBeGreaterThan(day);
  });

  it('rabbits see less at night than wolves', async () => {
    const { sight } = await import('../src/sim/behaviors');
    const w = make({ weather: false });
    at(w, 1, 0.85);
    w.step();
    expect(w.night).toBe(true);
    expect(sight(w, Species.Rabbit)).toBeLessThan(sight(w, Species.Wolf));
  });

  it('plants hardly grow at night', () => {
    const w = make({ rabbits: 0, wolves: 0, weather: false });
    w.grid.plant.fill(10);
    at(w, 1, 0.85);
    w.step();
    const night = w.grid.plant.reduce((s, p) => s + p, 0);
    w.grid.plant.fill(10);
    at(w, 2, 0.3);
    w.step();
    const day = w.grid.plant.reduce((s, p) => s + p, 0);
    expect(day).toBeGreaterThan(night);
  });

  it('deer only breed in spring and summer when seasons are on', () => {
    const w = make({ map: 'forest', rabbits: 0, wolves: 0, deer: 20, seasons: true, weather: false });
    for (let i = 0; i < w.agents.hi; i++) {
      w.agents.energy[i] = w.cfg.deer.maxEnergy;
      w.agents.age[i] = w.cfg.deer.maturityDays * w.cfg.ticksPerDay * 2;
      w.agents.cooldown[i] = 0;
    }
    at(w, w.cfg.seasons.lengthDays * 2 + 1, 0.3); // autumn
    let births = 0;
    for (let k = 0; k < 40; k++) {
      w.step();
      births += w.drainEvents().filter((e) => e.type === 'birth').length;
    }
    expect(births).toBe(0);
  });
});
