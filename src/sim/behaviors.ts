import { AState, Species } from './agents';
import { DX8, DY8 } from './grid';
import type { World } from './world';

// ───────────────────────── movement helpers ─────────────────────────

/** move agent i along (dx, dy) by `speed` tiles, sliding along obstacles */
export function moveDir(w: World, i: number, dx: number, dy: number, speed: number): void {
  const a = w.agents;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6 || speed <= 0) return;
  const ux = dx / len;
  const uy = dy / len;
  const g = w.grid;
  const x = a.x[i]!;
  const y = a.y[i]!;
  let nx = x + ux * speed;
  let ny = y + uy * speed;
  const maxX = g.w - 0.01;
  const maxY = g.h - 0.01;
  nx = nx < 0.01 ? 0.01 : nx > maxX ? maxX : nx;
  ny = ny < 0.01 ? 0.01 : ny > maxY ? maxY : ny;
  if (g.walkableAt(nx, ny)) {
    a.x[i] = nx;
    a.y[i] = ny;
  } else if (g.walkableAt(nx, y)) {
    a.x[i] = nx;
  } else if (g.walkableAt(x, ny)) {
    a.y[i] = ny;
  } else {
    // blocked: turn to a random direction
    const ang = w.rng.range(0, Math.PI * 2);
    a.hx[i] = Math.cos(ang);
    a.hy[i] = Math.sin(ang);
    return;
  }
  a.hx[i] = ux;
  a.hy[i] = uy;
}

function moveTo(w: World, i: number, tx: number, ty: number, speed: number): number {
  const a = w.agents;
  const dx = tx - a.x[i]!;
  const dy = ty - a.y[i]!;
  const d = Math.hypot(dx, dy);
  moveDir(w, i, dx, dy, Math.min(speed, d));
  return d;
}

function wander(w: World, i: number, speed: number): void {
  const a = w.agents;
  if (w.rng.chance(0.25)) return; // brief pauses look natural
  const ang = Math.atan2(a.hy[i]!, a.hx[i]!) + w.rng.range(-0.7, 0.7);
  moveDir(w, i, Math.cos(ang), Math.sin(ang), speed);
}

/** step toward lower waterDist; returns true if already next to water */
function seekWater(w: World, i: number, speed: number): boolean {
  const a = w.agents;
  const g = w.grid;
  const tx = Math.floor(a.x[i]!);
  const ty = Math.floor(a.y[i]!);
  const here = g.waterDist[g.idx(tx, ty)]!;
  if (here <= 1) return true;
  let best = here;
  let bx = -1;
  let by = -1;
  for (let d = 0; d < 8; d++) {
    const nx = tx + DX8[d]!;
    const ny = ty + DY8[d]!;
    if (!g.walkable(nx, ny)) continue;
    const wd = g.waterDist[g.idx(nx, ny)]!;
    if (wd < best) {
      best = wd;
      bx = nx;
      by = ny;
    }
  }
  if (bx < 0) wander(w, i, speed);
  else moveTo(w, i, bx + 0.5, by + 0.5, speed);
  return false;
}

function reproduce(w: World, i: number, species: Species): void {
  const a = w.agents;
  const sc = w.speciesCfg(species);
  const tpd = w.cfg.ticksPerDay;
  if (a.cooldown[i]! > 0) {
    a.cooldown[i]!--;
    return;
  }
  if (a.age[i]! < sc.maturityDays * tpd || a.energy[i]! < sc.reproThreshold) return;
  if (species === Species.Rabbit) {
    const near = w.rabbitHash.countNear(a, a.x[i]!, a.y[i]!, w.cfg.rabbit.crowdRadius, i);
    if (near >= w.cfg.rabbit.crowdMax) return;
  } else if (species === Species.Wolf) {
    const others = w.wolfHash.countNear(a, a.x[i]!, a.y[i]!, w.cfg.wolf.territoryRadius, i);
    if (others >= w.cfg.wolf.territoryMax) return;
  } else if (w.deerHash.countNear(a, a.x[i]!, a.y[i]!, 4, i) >= 3) return;
  const litter = w.rng.int(sc.litterMin, sc.litterMax);
  for (let k = 0; k < litter; k++) {
    if (a.energy[i]! - sc.birthEnergy - sc.birthCost < sc.maxEnergy * 0.15) break;
    a.energy[i]! -= sc.birthEnergy + sc.birthCost;
    w.queueBirth(species, a.x[i]!, a.y[i]!, sc.birthEnergy);
  }
  a.cooldown[i] = sc.reproCooldownDays * tpd * w.rng.range(0.85, 1.15);
}

// ───────────────────────── rabbits ─────────────────────────

export function updateRabbit(w: World, i: number): void {
  const a = w.agents;
  const r = w.cfg.rabbit;
  const g = w.grid;
  const x = a.x[i]!;
  const y = a.y[i]!;

  a.age[i]!++;
  if (a.age[i]! > a.maxAge[i]!) return w.kill(i, 'old');

  if (g.hasWater) {
    a.thirst[i]! += r.thirstPerTick * w.thirstMul;
    if (a.thirst[i]! >= 100) return w.kill(i, 'thirst');
  }

  let metab = r.metabolism * w.metabolismMul;
  let fleeing = false;

  // threat detection
  const wolf = w.wolfHash.nearest(a, x, y, r.vision * w.visionMul);
  const hiddenHere = g.isCover(x, y);
  if (wolf >= 0) {
    const wx = a.x[wolf]!;
    const wy = a.y[wolf]!;
    const dw = Math.hypot(wx - x, wy - y);
    if (hiddenHere && dw > w.cfg.wolf.coverDetect + 0.5) {
      // freeze in the bush
      a.state[i] = AState.Hide;
      metab *= r.restMetabolismMul;
    } else {
      fleeing = true;
      a.state[i] = AState.Flee;
      // look for a bush refuge that lies away from the wolf
      let rx = -1;
      let ry = -1;
      let rd = Infinity;
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      for (let oy = -2; oy <= 2; oy++) {
        for (let ox = -2; ox <= 2; ox++) {
          const bx = tx + ox;
          const by = ty + oy;
          if (!g.inBounds(bx, by) || !g.isCover(bx, by)) continue;
          const cx = bx + 0.5;
          const cy = by + 0.5;
          if (Math.hypot(cx - wx, cy - wy) <= dw) continue;
          const d = Math.hypot(cx - x, cy - y);
          if (d < rd) {
            rd = d;
            rx = cx;
            ry = cy;
          }
        }
      }
      let speed = r.walkSpeed;
      if (a.stamina[i]! >= 1) {
        speed = r.runSpeed;
        a.stamina[i]! -= 1;
        metab += r.sprintCost;
      }
      if (rx >= 0) moveTo(w, i, rx, ry, speed);
      else {
        const jitter = w.rng.range(-0.4, 0.4);
        const ang = Math.atan2(y - wy, x - wx) + jitter;
        moveDir(w, i, Math.cos(ang), Math.sin(ang), speed);
      }
      if (w.rng.chance(0.08)) w.emit({ type: 'flee', x, y });
    }
  }

  if (!fleeing && a.state[i] !== AState.Hide) {
    const e = a.energy[i]!;
    const restNow = w.night ? e > 35 : w.sheltering ? e > w.cfg.weather.shelterEnergy : w.siesta ? e > 55 : false;
    if (restNow && a.thirst[i]! < r.thirstSeek) {
      a.state[i] = AState.Sleep;
      metab *= r.restMetabolismMul;
    } else if (g.hasWater && a.thirst[i]! > r.thirstSeek && (e > 30 || a.thirst[i]! > 75 || g.plant[g.idx(Math.floor(x), Math.floor(y))]! < w.cfg.plant.minEdible)) {
      a.state[i] = AState.SeekWater;
      if (seekWater(w, i, r.walkSpeed)) {
        a.state[i] = AState.Drink;
        a.thirst[i] = Math.max(0, a.thirst[i]! - 25);
      }
    } else if (e < r.fullEnergy) {
      const ti = g.idx(Math.floor(x), Math.floor(y));
      const p = g.plant[ti]!;
      // giving-up density: on a thin patch, look around for a richer one first
      let moveOn = false;
      if (p < r.giveUp && a.state[i] === AState.Eat) {
        for (let k = 0; k < 4; k++) {
          const sx = Math.floor(x + w.rng.range(-3, 3));
          const sy = Math.floor(y + w.rng.range(-3, 3));
          if (g.walkable(sx, sy) && g.plant[g.idx(sx, sy)]! >= r.giveUp + 10) {
            a.tx[i] = sx + 0.5;
            a.ty[i] = sy + 0.5;
            moveOn = true;
            break;
          }
        }
      }
      // walking to a richer target: don't stop on thin tiles on the way
      let passingThrough = false;
      if (!moveOn && p < r.giveUp && a.state[i] === AState.SeekFood) {
        const ttx = Math.floor(a.tx[i]!);
        const tty = Math.floor(a.ty[i]!);
        if (g.inBounds(ttx, tty) && (ttx !== Math.floor(x) || tty !== Math.floor(y))) {
          passingThrough = g.plant[g.idx(ttx, tty)]! >= r.giveUp;
        }
      }
      if (!moveOn && !passingThrough && p >= w.cfg.plant.minEdible) {
        a.state[i] = AState.Eat;
        const bite = Math.min(p, w.cfg.plant.biteSize * (w.twilight ? w.cfg.time.rabbitTwilightBiteMul : 1));
        g.plant[ti] = p - bite;
        a.energy[i] = Math.min(r.maxEnergy, e + bite * r.plantEnergy);
        if (w.rng.chance(0.02)) w.emit({ type: 'eat', x, y });
      } else {
        a.state[i] = AState.SeekFood;
        // keep current target while it still has food, otherwise sample nearby tiles
        let tgx = a.tx[i]!;
        let tgy = a.ty[i]!;
        const tIdx = g.inBounds(Math.floor(tgx), Math.floor(tgy)) ? g.idx(Math.floor(tgx), Math.floor(tgy)) : -1;
        const reached = Math.hypot(tgx - x, tgy - y) < 0.3;
        if (!moveOn && (tIdx < 0 || reached || g.plant[tIdx]! < Math.min(r.giveUp, w.cfg.plant.minEdible * 2))) {
          let best = -1;
          let bx = 0;
          let by = 0;
          for (let k = 0; k < 8; k++) {
            const sx = Math.floor(x + w.rng.range(-4, 4));
            const sy = Math.floor(y + w.rng.range(-4, 4));
            if (!g.walkable(sx, sy)) continue;
            const pv = g.plant[g.idx(sx, sy)]!;
            if (pv > best) {
              best = pv;
              bx = sx + 0.5;
              by = sy + 0.5;
            }
          }
          if (best >= w.cfg.plant.minEdible * 2) {
            tgx = bx;
            tgy = by;
          } else {
            // nothing nearby: head off in the current direction to search further
            tgx = Math.min(g.w - 0.5, Math.max(0.5, x + a.hx[i]! * 6 + w.rng.range(-2, 2)));
            tgy = Math.min(g.h - 0.5, Math.max(0.5, y + a.hy[i]! * 6 + w.rng.range(-2, 2)));
          }
          a.tx[i] = tgx;
          a.ty[i] = tgy;
        }
        moveTo(w, i, tgx, tgy, r.walkSpeed);
      }
    } else {
      a.state[i] = AState.Wander;
      wander(w, i, r.walkSpeed * 0.5);
    }
  }

  if (!fleeing && a.stamina[i]! < r.stamina) a.stamina[i] = Math.min(r.stamina, a.stamina[i]! + r.staminaRegen);

  a.energy[i]! -= metab;
  if (a.energy[i]! <= 0) return w.kill(i, 'starved');

  if (!fleeing) reproduce(w, i, Species.Rabbit);
}

// ───────────────────────── wolves ─────────────────────────

export function updateWolf(w: World, i: number): void {
  const a = w.agents;
  const wc = w.cfg.wolf;
  const g = w.grid;
  const x = a.x[i]!;
  const y = a.y[i]!;

  a.age[i]!++;
  if (a.age[i]! > a.maxAge[i]!) return w.kill(i, 'old');

  if (g.hasWater) {
    a.thirst[i]! += wc.thirstPerTick * w.thirstMul;
    if (a.thirst[i]! >= 100) return w.kill(i, 'thirst');
  }

  let metab = wc.metabolism * w.metabolismMul;

  if (a.rest[i]! > 0) {
    // handling time after a kill: eating and resting
    a.rest[i]!--;
    a.state[i] = AState.Rest;
    metab *= wc.restMetabolismMul;
  } else if (g.hasWater && a.thirst[i]! > wc.thirstSeek) {
    a.state[i] = AState.SeekWater;
    if (seekWater(w, i, wc.walkSpeed * 1.2)) {
      a.state[i] = AState.Drink;
      a.thirst[i] = Math.max(0, a.thirst[i]! - 25);
    }
  } else {
    const hungry = a.energy[i]! < (w.sheltering ? wc.huntBelow * Math.min(1, w.cfg.weather.stormHuntBelow / wc.huntBelow) : wc.huntBelow) * wc.maxEnergy;
    let prey = -1;
    if (hungry) {
      const cd2 = wc.coverDetect * wc.coverDetect;
      prey = w.rabbitHash.nearest(a, x, y, wc.vision * w.visionMul, -1, (j, d2) => d2 <= cd2 || !g.isCover(a.x[j]!, a.y[j]!) || w.rng.chance(wc.scentChance * w.scentMul));
    }
    if (prey < 0 && hungry && w.counts[2]! > 0) {
      prey = w.deerHash.nearest(a, x, y, wc.vision * w.visionMul);
    }
    if (prey >= 0) {
      const isDeer = a.species[prey] === Species.Deer;
      a.state[i] = AState.Hunt;
      a.target[i] = prey;
      const d = moveTo(w, i, a.x[prey]!, a.y[prey]!, wc.runSpeed);
      metab += wc.chaseCost;
      if (d - wc.runSpeed <= wc.catchDist && w.rng.chance(wc.catchChance * (isDeer ? w.cfg.deer.wolfCatchMul : 1) * (w.night || w.twilight ? w.cfg.time.wolfNightCatchMul : 1))) {
        const px = a.x[prey]!;
        const py = a.y[prey]!;
        w.kill(prey, 'eaten');
        a.energy[i] = Math.min(wc.maxEnergy, a.energy[i]! + wc.preyEnergy * (isDeer ? w.cfg.deer.wolfEnergyMul : 1));
        a.rest[i] = wc.handlingTicks;
        w.emit({ type: 'catch', x: px, y: py });
      }
    } else {
      a.target[i] = -1;
      if (!hungry && (w.night || w.siesta)) {
        a.state[i] = AState.Rest;
        metab *= wc.restMetabolismMul;
      } else {
        a.state[i] = AState.Wander;
        packWander(w, i, hungry ? wc.walkSpeed * 1.3 : wc.walkSpeed * 0.7);
      }
    }
  }

  a.energy[i]! -= metab;
  if (a.energy[i]! <= 0) return w.kill(i, 'starved');

  reproduce(w, i, Species.Wolf);
}

/** loose flocking: random walk biased toward nearby pack mates */
function packWander(w: World, i: number, speed: number): void {
  const a = w.agents;
  const x = a.x[i]!;
  const y = a.y[i]!;
  let sx = 0;
  let sy = 0;
  let n = 0;
  let sepX = 0;
  let sepY = 0;
  w.wolfHash.forEachNear(a, x, y, 8, (j, d2) => {
    if (j === i) return;
    sx += a.x[j]!;
    sy += a.y[j]!;
    n++;
    if (d2 < 1) {
      sepX += x - a.x[j]!;
      sepY += y - a.y[j]!;
    }
  });
  let ang = Math.atan2(a.hy[i]!, a.hx[i]!) + w.rng.range(-0.6, 0.6);
  let dx = Math.cos(ang);
  let dy = Math.sin(ang);
  if (n > 0) {
    const cx = sx / n - x;
    const cy = sy / n - y;
    const cd = Math.hypot(cx, cy);
    if (cd > 2) {
      const c = w.cfg.wolf.cohesion;
      dx = dx * (1 - c) + (cx / cd) * c;
      dy = dy * (1 - c) + (cy / cd) * c;
    }
    dx += sepX * 0.5;
    dy += sepY * 0.5;
  }
  if (w.rng.chance(0.15)) return;
  moveDir(w, i, dx, dy, speed);
}

// ───────────────────────── deer ─────────────────────────

/** big grazer: bolts from wolves, rests in storms and at midday, browses patches rabbits leave */
export function updateDeer(w: World, i: number): void {
  const a = w.agents;
  const d = w.cfg.deer;
  const g = w.grid;
  const x = a.x[i]!;
  const y = a.y[i]!;

  a.age[i]!++;
  if (a.age[i]! > a.maxAge[i]!) return w.kill(i, 'old');
  if (g.hasWater) {
    a.thirst[i]! += d.thirstPerTick * w.thirstMul;
    if (a.thirst[i]! >= 100) return w.kill(i, 'thirst');
  }

  let metab = d.metabolism * w.metabolismMul;
  let fleeing = false;
  const wolf = w.wolfHash.nearest(a, x, y, d.vision * w.visionMul);
  // only run from wolves that are actually hunting or already close, so deer can still graze
  if (wolf >= 0 && (a.state[wolf] === AState.Hunt || Math.hypot(a.x[wolf]! - x, a.y[wolf]! - y) < 2.2)) {
    fleeing = true;
    a.state[i] = AState.Flee;
    const ang = Math.atan2(y - a.y[wolf]!, x - a.x[wolf]!) + w.rng.range(-0.35, 0.35);
    moveDir(w, i, Math.cos(ang), Math.sin(ang), d.runSpeed);
    metab += d.fleeCost;
    if (w.rng.chance(0.06)) w.emit({ type: 'flee', x, y });
  }

  if (!fleeing) {
    const e = a.energy[i]!;
    const restNow = w.night ? e > 50 : w.sheltering ? e > w.cfg.weather.shelterEnergy + 20 : w.siesta ? e > 70 : false;
    if (restNow && a.thirst[i]! < d.thirstSeek) {
      a.state[i] = AState.Sleep;
      metab *= d.restMetabolismMul;
    } else if (g.hasWater && a.thirst[i]! > d.thirstSeek && (e > 40 || a.thirst[i]! > 75)) {
      a.state[i] = AState.SeekWater;
      if (seekWater(w, i, d.walkSpeed)) {
        a.state[i] = AState.Drink;
        a.thirst[i] = Math.max(0, a.thirst[i]! - 25);
      }
    } else if (e < d.fullEnergy) {
      const ti = g.idx(Math.floor(x), Math.floor(y));
      const p = g.plant[ti]!;
      if (g.isCover(x, y)) {
        // browsing shrubs: deer live off bushes when grass is scarce
        a.state[i] = AState.Eat;
        a.energy[i] = Math.min(d.maxEnergy, e + d.browseEnergy);
        if (p >= w.cfg.plant.minEdible) {
          const bite = Math.min(p, d.biteSize);
          g.plant[ti] = p - bite;
          a.energy[i] = Math.min(d.maxEnergy, a.energy[i]! + bite * d.plantEnergy);
        }
        if (w.rng.chance(0.02)) w.emit({ type: 'eat', x, y });
      } else if (p >= w.cfg.plant.minEdible * 1.5) {
        a.state[i] = AState.Eat;
        const bite = Math.min(p, d.biteSize);
        g.plant[ti] = p - bite;
        a.energy[i] = Math.min(d.maxEnergy, e + bite * d.plantEnergy);
        if (w.rng.chance(0.02)) w.emit({ type: 'eat', x, y });
      } else {
        a.state[i] = AState.SeekFood;
        // keep walking to the chosen patch; only re-pick on arrival
        if (Math.hypot(a.tx[i]! - x, a.ty[i]! - y) < 0.5) {
          let best = -1;
          let bx = x + a.hx[i]! * 6;
          let by = y + a.hy[i]! * 6;
          for (let k = 0; k < 10; k++) {
            const sx = Math.floor(x + w.rng.range(-6, 6));
            const sy = Math.floor(y + w.rng.range(-6, 6));
            if (!g.walkable(sx, sy)) continue;
            const pv = g.plant[g.idx(sx, sy)]! + (g.isCover(sx, sy) ? 40 : 0);
            if (pv > best) {
              best = pv;
              bx = sx + 0.5;
              by = sy + 0.5;
            }
          }
          a.tx[i] = Math.min(g.w - 0.5, Math.max(0.5, bx));
          a.ty[i] = Math.min(g.h - 0.5, Math.max(0.5, by));
        }
        moveTo(w, i, a.tx[i]!, a.ty[i]!, d.walkSpeed);
      }
    } else {
      a.state[i] = AState.Wander;
      wander(w, i, d.walkSpeed * 0.5);
    }
  }

  a.energy[i]! -= metab;
  if (a.energy[i]! <= 0) return w.kill(i, 'starved');
  if (!fleeing) reproduce(w, i, Species.Deer);
}
