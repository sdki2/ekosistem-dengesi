/** ad-hoc tuning probe: npx tsx tests/balance/probe.ts */
import { World, type WorldOptions } from '../../src/sim/world';
import { withOverrides } from './harness';

const CFG = process.env.CFG ? withOverrides(JSON.parse(process.env.CFG)) : undefined;

const SEEDS = Array.from({ length: Number(process.env.N ?? 20) }, (_, i) => i + 1);
const DAYS = Number(process.env.DAYS ?? 300);

function probe(name: string, make: (seed: number) => WorldOptions): void {
  let core = 0;
  const alive = [0, 0, 0, 0, 0];
  const peak = [0, 0, 0, 0, 0];
  const deaths: string[] = [];
  for (const seed of SEEDS) {
    const w = new World({ cfg: CFG, ...make(seed) });
    const present = w.counts.map((c) => c > 0);
    let ok = true;
    for (let d = 1; d <= DAYS; d++) {
      w.run(w.cfg.ticksPerDay);
      w.drainEvents();
      for (let k = 0; k < 5; k++) peak[k] = Math.max(peak[k]!, w.counts[k]!);
      if (w.counts[0] === 0 || w.counts[1] === 0) {
        ok = false;
        deaths.push(`s${seed}${w.counts[0] === 0 ? 'r' : 'w'}@${d}`);
        break;
      }
    }
    if (ok) core++;
    for (let k = 0; k < 5; k++) if (ok && present[k] && w.counts[k]! > 0) alive[k]!++;
  }
  console.log(`${name}: core ${core}/${SEEDS.length} | alive@end r${alive[0]} w${alive[1]} deer${alive[2]} fox${alive[3]} bear${alive[4]} | peaks ${peak.join('/')} | ${deaths.slice(0, 8).join(' ')}`);
}

const which = process.env.P ?? 'base,full';
if (which.includes('base')) probe('base forest', (seed) => ({ seed, map: 'forest', rabbits: 60, wolves: 6 }));
if (which.includes('full')) {
  for (const map of ['forest', 'river'] as const) {
    probe(`full ${map}`, (seed) => ({ seed, map, rabbits: 50, wolves: 5, deer: 12, foxes: 4, bears: 2, weather: true, seasons: true }));
  }
}
if (which.includes('wx')) {
  for (const map of ['forest', 'river'] as const) probe(`wx ${map}`, (seed) => ({ seed, map, rabbits: 60, wolves: 6, weather: true }));
}
if (which.includes('seas')) {
  for (const map of ['forest', 'river'] as const) probe(`seasons ${map}`, (seed) => ({ seed, map, rabbits: 60, wolves: 6, weather: true, seasons: true }));
}
