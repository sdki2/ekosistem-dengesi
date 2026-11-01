import type { SimConfig } from '../config';

export const enum Tile {
  Grass = 0,
  Tree = 1,
  Water = 2,
  /** shallow crossing: walkable, drinkable, no plants */
  Ford = 3,
  /** bush / reeds: walkable, gives cover, plants grow */
  Bush = 4,
}

export type MapKind = 'forest' | 'river';

/** Tile grid: terrain types, plant amounts and per-tile regrowth multipliers. */
export class Grid {
  readonly w: number;
  readonly h: number;
  readonly tiles: Uint8Array;
  /** plant amount 0–100 */
  readonly plant: Float32Array;
  /** static regrowth multiplier (shade, water proximity); 0 = no plants */
  readonly growMul: Float32Array;
  /** BFS distance (tiles) to the nearest drinkable tile; 255 = none */
  readonly waterDist: Uint8Array;
  /** set when plant amounts change a lot (renderer hint) */
  hasWater = false;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.tiles = new Uint8Array(n);
    this.plant = new Float32Array(n);
    this.growMul = new Float32Array(n);
    this.waterDist = new Uint8Array(n).fill(255);
  }

  idx(x: number, y: number): number {
    return y * this.w + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** walkable at integer tile coords */
  walkable(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
    const t = this.tiles[ty * this.w + tx]!;
    return t !== Tile.Tree && t !== Tile.Water;
  }

  /** walkable at a continuous world position */
  walkableAt(x: number, y: number): boolean {
    return this.walkable(Math.floor(x), Math.floor(y));
  }

  canGrow(i: number): boolean {
    return this.growMul[i]! > 0;
  }

  isCover(x: number, y: number): boolean {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (!this.inBounds(tx, ty)) return false;
    return this.tiles[ty * this.w + tx] === Tile.Bush;
  }

  /** compute waterDist (BFS over walkable tiles) and growMul from terrain */
  finalize(cfg: SimConfig, kind: MapKind): void {
    const { w, h, tiles } = this;
    const n = w * h;
    // water distance
    this.waterDist.fill(255);
    const queue = new Int32Array(n);
    let qh = 0;
    let qt = 0;
    for (let i = 0; i < n; i++) {
      const t = tiles[i]!;
      if (t === Tile.Ford) {
        this.waterDist[i] = 0;
        queue[qt++] = i;
      }
    }
    // walkable tiles next to open water have distance 1
    for (let i = 0; i < n; i++) {
      if (tiles[i] !== Tile.Water) continue;
      this.hasWater = true;
      const x = i % w;
      const y = (i / w) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX4[d]!;
        const ny = y + DY4[d]!;
        if (!this.walkable(nx, ny)) continue;
        const j = ny * w + nx;
        if (this.waterDist[j]! > 1) {
          this.waterDist[j] = 1;
          queue[qt++] = j;
        }
      }
    }
    if (qt > 0) this.hasWater = true;
    while (qh < qt) {
      const i = queue[qh++]!;
      const x = i % w;
      const y = (i / w) | 0;
      const d0 = this.waterDist[i]!;
      if (d0 >= 254) continue;
      for (let d = 0; d < 8; d++) {
        const nx = x + DX8[d]!;
        const ny = y + DY8[d]!;
        if (!this.walkable(nx, ny)) continue;
        const j = ny * w + nx;
        if (this.waterDist[j]! > d0 + 1) {
          this.waterDist[j] = d0 + 1;
          queue[qt++] = j;
        }
      }
    }

    // regrowth multipliers
    for (let i = 0; i < n; i++) {
      const t = tiles[i]!;
      if (t === Tile.Tree || t === Tile.Water || t === Tile.Ford) {
        this.growMul[i] = 0;
        continue;
      }
      let m = 1;
      const x = i % w;
      const y = (i / w) | 0;
      // shade from adjacent trees
      let trees = 0;
      for (let d = 0; d < 8; d++) {
        const nx = x + DX8[d]!;
        const ny = y + DY8[d]!;
        if (this.inBounds(nx, ny) && tiles[ny * w + nx] === Tile.Tree) trees++;
      }
      if (trees > 0) m *= cfg.plant.shadeMul;
      if (kind === 'river') {
        const wd = this.waterDist[i]!;
        if (wd <= 1) m *= cfg.plant.nearWaterMul;
        else if (wd <= 4) m *= 1.0;
        else if (wd <= 8) m *= 0.75;
        else m *= cfg.plant.farWaterMul;
      }
      this.growMul[i] = m;
    }
  }

  /** mean plant cover over plantable tiles, 0–100 */
  meanCover(): number {
    let s = 0;
    let c = 0;
    for (let i = 0; i < this.plant.length; i++) {
      if (this.growMul[i]! > 0) {
        s += this.plant[i]!;
        c++;
      }
    }
    return c ? s / c : 0;
  }
}

export const DX4 = [1, -1, 0, 0];
export const DY4 = [0, 0, 1, -1];
export const DX8 = [1, -1, 0, 0, 1, 1, -1, -1];
export const DY8 = [0, 0, 1, -1, 1, -1, 1, -1];
