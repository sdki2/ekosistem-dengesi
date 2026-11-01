import type { AgentStore } from './agents';

/**
 * Uniform-grid spatial hash rebuilt once per tick with a counting sort.
 * Neighbor queries only scan the cells overlapping the search radius.
 */
export class SpatialHash {
  readonly cell: number;
  readonly cw: number;
  readonly ch: number;
  private counts: Int32Array;
  private starts: Int32Array;
  private items: Int32Array;
  size = 0;

  constructor(worldW: number, worldH: number, cell = 4) {
    this.cell = cell;
    this.cw = Math.ceil(worldW / cell);
    this.ch = Math.ceil(worldH / cell);
    this.counts = new Int32Array(this.cw * this.ch);
    this.starts = new Int32Array(this.cw * this.ch + 1);
    this.items = new Int32Array(1024);
  }

  private cellOf(x: number, y: number): number {
    let cx = Math.floor(x / this.cell);
    let cy = Math.floor(y / this.cell);
    if (cx < 0) cx = 0;
    else if (cx >= this.cw) cx = this.cw - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.ch) cy = this.ch - 1;
    return cy * this.cw + cx;
  }

  build(a: AgentStore, species: number): void {
    this.counts.fill(0);
    let n = 0;
    for (let i = 0; i < a.hi; i++) {
      if (a.alive[i] && a.species[i] === species) {
        this.counts[this.cellOf(a.x[i]!, a.y[i]!)]!++;
        n++;
      }
    }
    if (this.items.length < n) this.items = new Int32Array(Math.max(n, this.items.length * 2));
    let s = 0;
    for (let c = 0; c < this.counts.length; c++) {
      this.starts[c] = s;
      s += this.counts[c]!;
    }
    this.starts[this.counts.length] = s;
    const fill = this.starts.slice(0, this.counts.length);
    for (let i = 0; i < a.hi; i++) {
      if (a.alive[i] && a.species[i] === species) {
        const c = this.cellOf(a.x[i]!, a.y[i]!);
        this.items[fill[c]!++] = i;
      }
    }
    this.size = n;
  }

  /**
   * Visit agents within `r` of (x, y). The callback receives the slot and the
   * squared distance; return true to stop early.
   */
  forEachNear(a: AgentStore, x: number, y: number, r: number, fn: (i: number, d2: number) => boolean | void): void {
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor((x - r) / this.cell));
    const x1 = Math.min(this.cw - 1, Math.floor((x + r) / this.cell));
    const y0 = Math.max(0, Math.floor((y - r) / this.cell));
    const y1 = Math.min(this.ch - 1, Math.floor((y + r) / this.cell));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = cy * this.cw + cx;
        const end = this.starts[c + 1]!;
        for (let k = this.starts[c]!; k < end; k++) {
          const i = this.items[k]!;
          if (!a.alive[i]) continue;
          const dx = a.x[i]! - x;
          const dy = a.y[i]! - y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2 && fn(i, d2) === true) return;
        }
      }
    }
  }

  /** nearest agent within r, optionally filtered; -1 if none */
  nearest(a: AgentStore, x: number, y: number, r: number, exclude = -1, filter?: (i: number, d2: number) => boolean): number {
    let best = -1;
    let bestD = Infinity;
    this.forEachNear(a, x, y, r, (i, d2) => {
      if (i === exclude || d2 >= bestD) return;
      if (filter && !filter(i, d2)) return;
      best = i;
      bestD = d2;
    });
    return best;
  }

  countNear(a: AgentStore, x: number, y: number, r: number, exclude = -1): number {
    let n = 0;
    this.forEachNear(a, x, y, r, (i) => {
      if (i !== exclude) n++;
    });
    return n;
  }
}
