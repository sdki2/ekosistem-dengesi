import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Wx } from '../src/sim/weather';

const make = (over: Partial<ConstructorParameters<typeof World>[0]> = {}) =>
  new World({ seed: 5, map: 'forest', rabbits: 40, wolves: 4, weather: true, ...over });

describe('weather', () => {
  it('is deterministic for a seed', () => {
    const a = make();
    const b = make();
    a.run(400);
    b.run(400);
    expect(a.hash()).toBe(b.hash());
    expect(a.wx.kind).toBe(b.wx.kind);
  });

  it('does nothing when disabled', () => {
    const w = make({ weather: false });
    w.run(200);
    expect(w.wx.kind).toBe(Wx.Clear);
    expect(w.visionMul).toBe(1);
    expect(w.thirstMul).toBe(1);
  });

  it('rain wets the soil and heat dries it', () => {
    const w = make();
    w.wx.moisture = 0.5;
    w.wx.kind = Wx.Rain;
    w.wx.until = Infinity;
    w.run(40);
    const wet = w.wx.moisture;
    expect(wet).toBeGreaterThan(0.5);
    w.wx.kind = Wx.Heat;
    w.run(40);
    expect(w.wx.moisture).toBeLessThan(wet);
  });

  it('wet soil grows plants faster than dry soil', () => {
    const w = make();
    w.wx.until = Infinity;
    w.wx.kind = Wx.Cloudy;
    w.wx.moisture = 1;
    const wet = w.regrowMultiplier();
    w.wx.moisture = 0;
    expect(wet).toBeGreaterThan(w.regrowMultiplier() * 1.5);
  });

  it('fog and storms shorten sight', () => {
    const w = make();
    w.wx.until = Infinity;
    w.wx.kind = Wx.Fog;
    w.step();
    expect(w.visionMul).toBeLessThan(0.7);
    w.wx.kind = Wx.Clear;
    w.step();
    expect(w.visionMul).toBe(1);
  });

  it('snapshots restore the weather state', () => {
    const w = make();
    w.run(120);
    const snap = w.serialize();
    w.run(200);
    const h1 = w.hash();
    const k1 = w.wx.kind;
    w.restore(snap);
    w.run(200);
    expect(w.hash()).toBe(h1);
    expect(w.wx.kind).toBe(k1);
  });

  it('snows in winter', () => {
    const w = make({ seasons: true });
    w.tick = w.cfg.ticksPerDay * w.cfg.seasons.lengthDays * 3;
    const seen = new Set<Wx>();
    for (let i = 0; i < w.cfg.ticksPerDay * 12; i++) {
      w.step();
      seen.add(w.wx.kind);
    }
    expect(seen.has(Wx.Snow)).toBe(true);
    expect(seen.has(Wx.Heat)).toBe(false);
  });
});
