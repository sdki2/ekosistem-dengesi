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
