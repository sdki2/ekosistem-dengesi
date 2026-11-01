import { Species } from '../../src/sim/agents';
import type { Session } from '../../src/game/session';

/**
 * A "reasonable player": looks at the counters once per in-game day and makes
 * the small, sensible interventions a student would after reading the
 * encyclopedia. Proves that every level is solvable.
 */
export function reasonablePlayer(s: Session): void {
  const w = s.world;
  const [rabbits, wolves] = w.counts;
  const a = w.agents;

  const lushSpot = (): [number, number] => {
    let best: [number, number] = [w.grid.w / 2, w.grid.h / 2];
    let bp = -1;
    for (let k = 0; k < 40; k++) {
      const x = Math.floor(w.rng.next() * w.grid.w);
      const y = Math.floor(w.rng.next() * w.grid.h);
      if (!w.grid.walkable(x, y)) continue;
      const p = w.grid.plant[w.grid.idx(x, y)]!;
      if (p > bp) {
        bp = p;
        best = [x + 0.5, y + 0.5];
      }
    }
    return best;
  };
  const randomOf = (sp: Species): number => {
    const ids: number[] = [];
    for (let i = 0; i < a.hi; i++) if (a.alive[i] && a.species[i] === sp) ids.push(i);
    return ids.length ? ids[Math.floor(w.rng.next() * ids.length)]! : -1;
  };

  // 1. a predator-free level: bring wolves in early
  if (s.level?.goal.kind === 'recover' && w.day <= 3 && wolves < 7) {
    for (let k = wolves; k < 7; k++) {
      const r = randomOf(Species.Rabbit);
      if (r < 0) break;
      s.apply('wolf', a.x[r]!, a.y[r]!, 1);
    }
  }

  // 2. too few rabbits: restock on lush ground, and thin wolves so they recover
  if (rabbits > 0 && rabbits < 25) {
    for (let k = rabbits; k < 25; k++) {
      const [x, y] = lushSpot();
      if (!s.apply('rabbit', x, y, 1).ok) break;
    }
  }
  if (wolves > 2 && w.counts[0] < wolves * 5) {
    let extra = wolves - Math.max(2, Math.floor(w.counts[0] / 5));
    while (extra-- > 0) {
      const f = randomOf(Species.Wolf);
      if (f >= 0) w.kill(f, 'removed');
    }
  }

  // 3. too few wolves while prey is plentiful
  if (wolves > 0 && wolves < 3 && w.counts[0] >= 40) {
    for (let k = wolves; k < 3; k++) {
      const r = randomOf(Species.Rabbit);
      if (r < 0 || !s.apply('wolf', a.x[r]!, a.y[r]!, 1).ok) break;
    }
  }
  if (wolves === 0 && w.everPresent[Species.Wolf] === false && w.counts[0] > 60 && s.level?.goal.kind !== 'recover') {
    const r = randomOf(Species.Rabbit);
    if (r >= 0) s.apply('wolf', a.x[r]!, a.y[r]!, 1);
  }

  // 4. rabbit boom: cull (free) to stop overgrazing and flatten the cycle
  const cap = s.level?.goal.kind === 'stable' ? 320 : s.level?.goal.kind === 'recover' ? 220 : 480;
  if (w.counts[0] > cap) {
    let extra = w.counts[0] - Math.floor(cap * 0.8);
    while (extra-- > 0) {
      const r = randomOf(Species.Rabbit);
      if (r >= 0) w.kill(r, 'removed');
    }
  }
}
