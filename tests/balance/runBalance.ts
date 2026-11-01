/**
 * Headless balance report:  npm run balance
 *  1. Default "Easy" setup: 300 days × 20 seeds, no player → survival rate + ranges.
 *  2. Every scenario level: 20 seeds, untouched vs. scripted reasonable player.
 *  3. Performance: average tick time with ~1,500 animals.
 */
import { LEVELS } from '../../src/content/levels';
import { Session } from '../../src/game/session';
import { Species } from '../../src/sim/agents';
import { World } from '../../src/sim/world';
import { fmt, runSeeds } from './harness';
import { reasonablePlayer } from './player';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

export function easyReport(seeds = SEEDS, days = 300) {
  return runSeeds((seed) => ({ seed, map: 'forest', rabbits: 60, wolves: 6 }), seeds, days);
}

export interface LevelReport {
  id: number;
  untouchedWin: number;
  playerWin: number;
  playerStars: number;
}

export function playLevel(levelIdx: number, seedOffset: number, withPlayer: boolean): Session {
  const base = LEVELS[levelIdx]!;
  const level = { ...base, seed: base.seed + seedOffset };
  const s = new Session({ mode: 'scenario', level });
  const tpd = s.world.cfg.ticksPerDay;
  while (s.status === 'playing') {
    if (withPlayer && s.world.tick % tpd === 0) reasonablePlayer(s);
    s.step();
    if (s.world.day > level.goal.days + 1) break;
  }
  return s;
}

export function levelReport(levelIdx: number, seeds = SEEDS): LevelReport {
  let u = 0;
  let p = 0;
  let stars = 0;
  for (const k of seeds) {
    if (playLevel(levelIdx, k - 1, false).status === 'won') u++;
    const s = playLevel(levelIdx, k - 1, true);
    if (s.status === 'won') {
      p++;
      stars += s.stars();
    }
  }
  return { id: LEVELS[levelIdx]!.id, untouchedWin: u / seeds.length, playerWin: p / seeds.length, playerStars: p ? stars / p : 0 };
}

export function perfReport(): { msPerTick: number; animals: number } {
  const w = new World({ seed: 77, map: 'forest', rabbits: 1300, wolves: 200 });
  w.cfg.maxAnimals = 1500;
  // keep the population near 1,500 for the measurement
  w.run(20);
  const t0 = performance.now();
  const N = 400;
  let n = 0;
  for (let k = 0; k < N; k++) {
    w.step();
    w.drainEvents();
    n += w.totalAnimals();
    if (w.counts[Species.Rabbit] < 1200) {
      for (let j = 0; j < 50; j++) {
        const [x, y] = w.randomWalkable();
        w.spawnAnimal(Species.Rabbit, x, y, true);
      }
    }
  }
  return { msPerTick: (performance.now() - t0) / N, animals: Math.round(n / N) };
}

// CLI
const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('tests/balance/runBalance.ts');
if (isMain) {
  console.log('── Kolay senaryo (Orman, 60 tavşan + 6 kurt, 300 gün, oyuncu yok) ──');
  console.log(fmt(easyReport()));
  console.log('\n── Bölümler (20 tohum: dokunulmadan / makul oyuncu ile) ──');
  for (let i = 0; i < LEVELS.length; i++) {
    const r = levelReport(i);
    const L = LEVELS[i]!;
    console.log(
      `Bölüm ${r.id} (${L.map}, ${L.goal.kind} ${L.goal.days}g): dokunulmadan ${(r.untouchedWin * 100).toFixed(0)}% | oyuncu ile ${(r.playerWin * 100).toFixed(0)}% | ort. yıldız ${r.playerStars.toFixed(1)}`,
    );
  }
  const p = perfReport();
  console.log(`\n── Performans ── ${p.animals} hayvan: ${p.msPerTick.toFixed(3)} ms/tick (8× hızda saniyede 160 tick → ${(p.msPerTick * 160).toFixed(1)} ms/s)`);
}
