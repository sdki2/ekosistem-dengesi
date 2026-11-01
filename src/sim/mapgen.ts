import type { SimConfig } from '../config';
import { Grid, Tile, type MapKind } from './grid';
import { Rng } from './rng';

/** Smooth value noise on a lattice, sampled bilinearly with smoothstep. */
function makeNoise(rng: Rng, w: number, h: number, cell: number): (x: number, y: number) => number {
  const gw = Math.ceil(w / cell) + 2;
  const gh = Math.ceil(h / cell) + 2;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = rng.next();
  return (x, y) => {
    const fx = x / cell;
    const fy = y / cell;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = g[y0 * gw + x0]!;
    const b = g[y0 * gw + x0 + 1]!;
    const c = g[(y0 + 1) * gw + x0]!;
    const d = g[(y0 + 1) * gw + x0 + 1]!;
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

export function generateMap(cfg: SimConfig, kind: MapKind, seed: number, initialPlant: [number, number] = [60, 100]): Grid {
  const rng = new Rng(seed ^ 0x51ed);
  const { width: w, height: h } = cfg;
  const grid = new Grid(w, h);
  const n1 = makeNoise(rng, w, h, 9);
  const n2 = makeNoise(rng, w, h, 4);
  const n3 = makeNoise(rng, w, h, 3);

  if (kind === 'forest') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = n1(x, y) * 0.7 + n2(x, y) * 0.3;
        const i = grid.idx(x, y);
        if (v > 0.66) grid.tiles[i] = Tile.Tree;
        else if (v > 0.625 || n3(x, y) > 0.9) grid.tiles[i] = Tile.Bush;
        else grid.tiles[i] = Tile.Grass;
      }
    }
  } else {
    // meandering river from left to right
    const baseY = h * rng.range(0.4, 0.6);
    const amp1 = rng.range(3, 5);
    const amp2 = rng.range(1, 2);
    const f1 = rng.range(0.06, 0.09);
    const f2 = rng.range(0.18, 0.28);
    const p1 = rng.range(0, Math.PI * 2);
    const p2 = rng.range(0, Math.PI * 2);
    const centerAt = (x: number) => baseY + Math.sin(x * f1 + p1) * amp1 + Math.sin(x * f2 + p2) * amp2;
    // fords at 3 spread-out columns
    const fords = [Math.floor(w * rng.range(0.12, 0.22)), Math.floor(w * rng.range(0.45, 0.55)), Math.floor(w * rng.range(0.78, 0.88))];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = grid.idx(x, y);
        const c = centerAt(x + 0.5);
        const halfW = 1.3 + n2(x, y) * 0.9;
        const d = Math.abs(y + 0.5 - c);
        const isFord = fords.some((fx) => Math.abs(x - fx) <= 1);
        if (d < halfW) {
          grid.tiles[i] = isFord ? Tile.Ford : Tile.Water;
        } else {
          const v = n1(x, y) * 0.6 + n2(x, y) * 0.4;
          if (v > 0.74 && d > 4) grid.tiles[i] = Tile.Tree;
          else if ((d < halfW + 1.6 && n3(x, y) > 0.6 && !isFord) || v > 0.7 || n3(x, y) > 0.92) grid.tiles[i] = Tile.Bush;
          else grid.tiles[i] = Tile.Grass;
        }
      }
    }
  }

  if (kind === 'forest') carvePonds(grid, seed, n3);
  grid.computeShoreRanks();
  grid.finalize(cfg, kind);

  for (let i = 0; i < grid.plant.length; i++) {
    grid.plant[i] = grid.growMul[i]! > 0 ? rng.range(initialPlant[0], initialPlant[1]) : 0;
  }
  return grid;
}

/** two small ponds in the forest, drawn from their own RNG so the rest of the map is unchanged */
function carvePonds(grid: Grid, seed: number, n3: (x: number, y: number) => number): void {
  const r = new Rng(seed ^ 0x90d5);
  const { w, h } = grid;
  const centers: [number, number][] = [];
  for (let tries = 0; tries < 200 && centers.length < 2; tries++) {
    const cx = r.range(10, w - 10);
    const cy = r.range(7, h - 7);
    if (centers.every(([x, y]) => Math.hypot(x - cx, y - cy) > 22)) centers.push([cx, cy]);
  }
  for (const [cx, cy] of centers) {
    const rx = r.range(2.8, 3.8);
    const ry = r.range(2.1, 2.9);
    for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) {
      for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
        if (!grid.inBounds(x, y)) continue;
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy) + (n3(x, y) - 0.5) * 0.35;
        const i = grid.idx(x, y);
        if (d < 1) grid.tiles[i] = Tile.Water;
        else if (d < 1.3 && grid.tiles[i] !== Tile.Water) grid.tiles[i] = n3(x, y) > 0.45 ? Tile.Bush : Tile.Grass;
      }
    }
  }
}
