import { PALETTE as P, plantColor, rgb, type RGB } from '../content/palette';
import { AState, Species } from '../sim/agents';
import { Tile } from '../sim/grid';
import type { World } from '../sim/world';
import { Camera } from './camera';
import { Fx } from './fx';
import { WeatherFx } from './weatherFx';
import { getSprites, mulberry, RABBIT_FRAMES, WOLF_FRAMES, type SpriteSet } from './sprites';

const BAKE = 16; // px per tile for baked layers

export interface Overlay {
  /** world position of the pointer, or null */
  hover: [number, number] | null;
  tool: string;
  brush: number;
  selectedUid: number;
  hoverUid: number;
}

/** Draws the world. Reads simulation state only; never mutates it. */
export class WorldRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  readonly cam = new Camera();
  readonly fx = new Fx();
  readonly weatherFx = new WeatherFx();
  private sprites: SpriteSet;
  private dpr = 1;
  private world: World | null = null;
  private plantCanvas!: HTMLCanvasElement;
  private plantG!: CanvasRenderingContext2D;
  private plantImg!: ImageData;
  private waterLayer!: HTMLCanvasElement;
  private decorLayer!: HTMLCanvasElement;
  private trees: { x: number; y: number; v: number; phase: number; s: number }[] = [];
  private ryBuf = new Float32Array(2048);
  private waterTiles: { x: number; y: number; h: number }[] = [];
  private tileHash!: Float32Array;
  private order: number[] = [];
  time = 0;
  /** animation clock, advances with simulation speed */
  animClock = 0;
  reducedMotion = false;
  showTufts = true;
  private tmpColor: RGB = [0, 0, 0];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d', { alpha: false })!;
    this.sprites = getSprites();
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    this.cam.resize(r.width, r.height);
    this.cam.clamp();
  }

  /** (re)build baked layers for a new world */
  setWorld(w: World): void {
    this.world = w;
    const g = w.grid;
    this.cam.setWorld(g.w, g.h);
    this.plantCanvas = document.createElement('canvas');
    this.plantCanvas.width = g.w;
    this.plantCanvas.height = g.h;
    this.plantG = this.plantCanvas.getContext('2d')!;
    this.plantImg = this.plantG.createImageData(g.w, g.h);
    const rnd = mulberry(w.seed);
    this.tileHash = new Float32Array(g.w * g.h);
    for (let i = 0; i < this.tileHash.length; i++) this.tileHash[i] = rnd();

    // water layer
    this.waterLayer = document.createElement('canvas');
    this.waterLayer.width = g.w * BAKE;
    this.waterLayer.height = g.h * BAKE;
    const wg = this.waterLayer.getContext('2d')!;
    this.waterTiles = [];
    const isWet = (x: number, y: number) => g.inBounds(x, y) && (g.tiles[g.idx(x, y)] === Tile.Water || g.tiles[g.idx(x, y)] === Tile.Ford);
    // shallow rim
    wg.fillStyle = rgb(P.water);
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        if (!isWet(x, y)) continue;
        this.waterTiles.push({ x, y, h: this.tileHash[g.idx(x, y)]! });
        wg.beginPath();
        wg.arc((x + 0.5) * BAKE, (y + 0.5) * BAKE, BAKE * 0.78, 0, Math.PI * 2);
        wg.fill();
      }
    // deep centre
    wg.fillStyle = rgb(P.waterDeep);
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        if (g.tiles[g.idx(x, y)] !== Tile.Water) continue;
        if (isWet(x + 1, y) && isWet(x - 1, y) && isWet(x, y + 1) && isWet(x, y - 1)) {
          wg.beginPath();
          wg.arc((x + 0.5) * BAKE, (y + 0.5) * BAKE, BAKE * 0.62, 0, Math.PI * 2);
          wg.fill();
        }
      }
    // fords: pebbles
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        if (g.tiles[g.idx(x, y)] !== Tile.Ford) continue;
        wg.fillStyle = rgb(P.ford);
        wg.fillRect(x * BAKE, y * BAKE, BAKE, BAKE);
        for (let k = 0; k < 3; k++) {
          wg.fillStyle = k % 2 ? '#c9c2b4' : '#ddd6c8';
          wg.beginPath();
          wg.ellipse((x + 0.2 + rnd() * 0.6) * BAKE, (y + 0.2 + rnd() * 0.6) * BAKE, BAKE * 0.12, BAKE * 0.08, 0, 0, Math.PI * 2);
          wg.fill();
        }
      }

    // decor: ground texture + bushes
    this.decorLayer = document.createElement('canvas');
    this.decorLayer.width = g.w * BAKE;
    this.decorLayer.height = g.h * BAKE;
    const dg = this.decorLayer.getContext('2d')!;
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        const t = g.tiles[g.idx(x, y)];
        if (t === Tile.Water || t === Tile.Ford) continue;
        for (let k = 0; k < 3; k++) {
          dg.fillStyle = rnd() < 0.5 ? 'rgba(255,255,240,0.10)' : 'rgba(60,70,40,0.07)';
          dg.beginPath();
          dg.arc((x + rnd()) * BAKE, (y + rnd()) * BAKE, BAKE * (0.06 + rnd() * 0.08), 0, Math.PI * 2);
          dg.fill();
        }
      }
    const bs = this.sprites.bushes;
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        if (g.tiles[g.idx(x, y)] !== Tile.Bush) continue;
        const img = bs[Math.floor(rnd() * bs.length)]!;
        const s = BAKE * (1.05 + rnd() * 0.25);
        dg.drawImage(img, (x + 0.5) * BAKE - s / 2 + (rnd() - 0.5) * 3, (y + 0.5) * BAKE - s / 2 + (rnd() - 0.5) * 3, s, s);
      }

    // trees (drawn per frame for sway + depth sorting)
    this.trees = [];
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++)
        if (g.tiles[g.idx(x, y)] === Tile.Tree) this.trees.push({ x: x + 0.5 + (rnd() - 0.5) * 0.5, y: y + 0.7 + rnd() * 0.3, v: Math.floor(rnd() * 3), phase: rnd() * 6.28, s: 1.45 + rnd() * 0.55 });
    this.trees.sort((a, b) => a.y - b.y);
    this.fx.clear();
    this.cam.fit();
  }

  private updatePlantLayer(): void {
    const w = this.world!;
    const g = w.grid;
    const d = this.plantImg.data;
    const c = this.tmpColor;
    const sand: RGB = [222, 208, 170];
    for (let i = 0; i < g.plant.length; i++) {
      const t = g.tiles[i];
      if (t === Tile.Water || t === Tile.Ford) {
        d[i * 4] = sand[0];
        d[i * 4 + 1] = sand[1];
        d[i * 4 + 2] = sand[2];
      } else if (t === Tile.Tree) {
        plantColor(55, c);
        d[i * 4] = c[0] * 0.92;
        d[i * 4 + 1] = c[1] * 0.92;
        d[i * 4 + 2] = c[2] * 0.92;
      } else {
        plantColor(g.plant[i]!, c);
        // gentle per-tile variation
        const v = 0.96 + this.tileHash[i]! * 0.08;
        d[i * 4] = c[0] * v;
        d[i * 4 + 1] = c[1] * v;
        d[i * 4 + 2] = c[2] * v;
      }
      d[i * 4 + 3] = 255;
    }
    this.plantG.putImageData(this.plantImg, 0, 0);
  }

  render(alpha: number, dt: number, simSpeed: number, overlay: Overlay): void {
    const w = this.world;
    if (!w) return;
    this.time += dt;
    if (!this.reducedMotion) this.animClock += dt * Math.max(0, simSpeed);
    const g = this.g;
    const cam = this.cam;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#cfe6c0';
    g.fillRect(0, 0, cam.vw, cam.vh);

    const grid = w.grid;
    const [ox, oy] = cam.toScreen(0, 0);
    const Z = cam.zoom;
    const W = grid.w * Z;
    const H = grid.h * Z;

    // soft frame around the map
    g.fillStyle = 'rgba(80,110,70,0.18)';
    g.beginPath();
    g.roundRect(ox - 6, oy - 6, W + 12, H + 12, 14);
    g.fill();

    // ground (plants), bilinear-smoothed for a soft look
    this.updatePlantLayer();
    g.save();
    g.beginPath();
    g.roundRect(ox, oy, W, H, 10);
    g.clip();
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(this.plantCanvas, ox, oy, W, H);
    g.drawImage(this.decorLayer, ox, oy, W, H);
    g.drawImage(this.waterLayer, ox, oy, W, H);
    this.drawRipples(ox, oy, Z);

    const [vx0, vy0, vx1, vy1] = cam.view();
    const tx0 = Math.max(0, Math.floor(vx0) - 1);
    const ty0 = Math.max(0, Math.floor(vy0) - 1);
    const tx1 = Math.min(grid.w - 1, Math.ceil(vx1) + 1);
    const ty1 = Math.min(grid.h - 1, Math.ceil(vy1) + 1);

    if (this.showTufts && Z >= 12) this.drawTufts(tx0, ty0, tx1, ty1, ox, oy, Z);
    g.restore();

    this.drawEntities(alpha, overlay, vx0, vy0, vx1, vy1);

    // fx
    this.fx.update(dt);
    this.weatherFx.reducedMotion = this.reducedMotion;
    this.weatherFx.update(w.weatherEnabled ? w.wx.kind : null, dt);
    this.fx.draw(g, (x, y) => cam.toScreen(x, y), Z);

    // environment tints
    this.drawEnvironment(ox, oy, W, H);

    // tool overlay
    this.drawOverlay(overlay);
  }

  private drawRipples(ox: number, oy: number, Z: number): void {
    if (this.reducedMotion || Z < 8) return;
    const g = this.g;
    g.strokeStyle = rgb(P.waterFoam, 0.55);
    g.lineWidth = Math.max(1, Z * 0.05);
    const t = this.time;
    for (const wt of this.waterTiles) {
      if (wt.h > 0.45) continue;
      const ph = (t * 0.35 + wt.h * 10) % 1;
      const sx = ox + (wt.x + 0.5) * Z;
      const sy = oy + (wt.y + 0.5) * Z;
      g.globalAlpha = Math.sin(ph * Math.PI) * 0.8;
      g.beginPath();
      g.ellipse(sx, sy, Z * (0.1 + ph * 0.3), Z * (0.05 + ph * 0.12), 0, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  private drawTufts(tx0: number, ty0: number, tx1: number, ty1: number, ox: number, oy: number, Z: number): void {
    const g = this.g;
    const grid = this.world!.grid;
    const tufts = this.sprites.tufts;
    const t = this.time;
    for (let y = ty0; y <= ty1; y++) {
      for (let x = tx0; x <= tx1; x++) {
        const i = y * grid.w + x;
        const p = grid.plant[i]!;
        if (p < 45 || grid.growMul[i] === 0) continue;
        const h = this.tileHash[i]!;
        const count = p > 80 ? 2 : 1;
        for (let k = 0; k < count; k++) {
          const hh = (h * (k + 1) * 7.13) % 1;
          let v = Math.floor(hh * 5);
          if (p < 75 && (v === 2 || v === 4)) v = 0; // flowers only on lush tiles
          const sway = this.reducedMotion ? 1 : Math.round(Math.sin(t * 1.6 + x * 0.5 + y * 0.3) + 1);
          const img = tufts[v]![Math.max(0, Math.min(2, sway))]!;
          const s = Z * (0.5 + (p / 100) * 0.35);
          g.drawImage(img, ox + (x + 0.2 + hh * 0.6) * Z - s / 2, oy + (y + 0.25 + ((hh * 3.7) % 1) * 0.6) * Z - s * 0.85, s, s);
        }
      }
    }
  }

  private drawEntities(alpha: number, ov: Overlay, vx0: number, vy0: number, vx1: number, vy1: number): void {
    const w = this.world!;
    const a = w.agents;
    const g = this.g;
    const cam = this.cam;
    const Z = cam.zoom;
    const S = this.sprites;

    // collect visible animals
    const order = this.order;
    order.length = 0;
    if (this.ryBuf.length < a.hi) this.ryBuf = new Float32Array(a.cap);
    const ry = this.ryBuf;
    for (let i = 0; i < a.hi; i++) {
      if (!a.alive[i]) continue;
      const x = a.px[i]! + (a.x[i]! - a.px[i]!) * alpha;
      const y = a.py[i]! + (a.y[i]! - a.py[i]!) * alpha;
      if (x < vx0 - 2 || x > vx1 + 2 || y < vy0 - 2 || y > vy1 + 2) continue;
      ry[i] = y;
      order.push(i);
    }
    order.sort((p, q) => ry[p]! - ry[q]!);

    const trees = this.trees;
    let ti = 0;
    const drawTreesUntil = (yy: number) => {
      while (ti < trees.length && trees[ti]!.y <= yy) {
        const tr = trees[ti++]!;
        if (tr.x < vx0 - 2 || tr.x > vx1 + 2 || tr.y < vy0 - 1 || tr.y > vy1 + 3) continue;
        const [sx, sy] = cam.toScreen(tr.x, tr.y);
        const s = Z * tr.s;
        // shadow
        g.drawImage(S.shadow, sx - s * 0.4, sy - s * 0.08, s * 0.8, s * 0.22);
        const sway = this.reducedMotion ? 0 : Math.sin(this.time * 0.9 + tr.phase) * 0.035;
        g.save();
        g.translate(sx, sy);
        g.transform(1, 0, sway, 1, 0, 0);
        g.drawImage(S.trees[tr.v]!, -s / 2, -s * 0.92, s, s);
        g.restore();
      }
    };

    const tpd = w.cfg.ticksPerDay;
    for (const i of order) {
      const y = ry[i]!;
      drawTreesUntil(y);
      const x = a.px[i]! + (a.x[i]! - a.px[i]!) * alpha;
      const sp = a.species[i] as Species;
      const st = a.state[i] as AState;
      const moving = Math.abs(a.x[i]! - a.px[i]!) + Math.abs(a.y[i]! - a.py[i]!) > 0.01;
      const sc = sp === Species.Rabbit ? w.cfg.rabbit : w.cfg.wolf;
      const grow = 0.6 + 0.4 * Math.min(1, a.age[i]! / (sc.maturityDays * tpd));
      const flip = a.hx[i]! < 0;
      const [sx, sy] = cam.toScreen(x, y);
      const uid = a.uid[i]!;
      const phase = this.animClock * (sp === Species.Rabbit ? 2.2 : 2.6) + (uid % 17) * 0.37;

      let img: HTMLCanvasElement;
      let size: number;
      let hop = 0;
      let anchorX: number;
      let anchorY: number;
      if (sp === Species.Rabbit) {
        size = Z * 0.95 * grow;
        anchorX = 0.45;
        anchorY = 0.8;
        if (st === AState.Sleep) img = S.rabbit[6]!;
        else if (!moving) img = S.rabbit[st === AState.Hide || st === AState.Flee ? 7 : 0]!;
        else {
          const f = Math.floor((phase % 1) * RABBIT_FRAMES);
          img = S.rabbit[f]!;
          hop = Math.sin((phase % 1) * Math.PI) * (st === AState.Flee ? 0.3 : 0.18);
        }
      } else {
        size = Z * 1.45 * grow;
        anchorX = 0.45;
        anchorY = 0.74;
        if (st === AState.Rest) img = S.wolf[6]!;
        else if (!moving) img = S.wolf[0]!;
        else img = S.wolf[Math.floor((phase % 1) * WOLF_FRAMES)]!;
      }

      // selection / hover ring with status colour
      const selected = uid === ov.selectedUid;
      if (selected || uid === ov.hoverUid) {
        const e = a.energy[i]! / sc.maxEnergy;
        const col = e > 0.5 ? P.healthy : e > 0.25 ? P.hungry : P.starving;
        g.strokeStyle = col;
        g.lineWidth = selected ? 3 : 2;
        g.setLineDash(selected ? [] : [4, 3]);
        g.beginPath();
        g.ellipse(sx, sy, size * 0.42, size * 0.2, 0, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
      }

      // shadow
      g.globalAlpha = 1 - hop;
      g.drawImage(S.shadow, sx - size * 0.3, sy - size * 0.06, size * 0.6, size * 0.16);
      g.globalAlpha = st === AState.Hide ? 0.55 : 1;
      const dy = -hop * Z;
      if (flip) {
        g.save();
        g.translate(sx, sy + dy);
        g.scale(-1, 1);
        g.drawImage(img, -size * anchorX, -size * anchorY, size, size);
        g.restore();
      } else {
        g.drawImage(img, sx - size * anchorX, sy + dy - size * anchorY, size, size);
      }
      g.globalAlpha = 1;

      if (selected) {
        // energy bar above
        const e = Math.max(0, Math.min(1, a.energy[i]! / sc.maxEnergy));
        const bw = Math.max(26, size * 0.7);
        const bx = sx - bw / 2;
        const by = sy - size * 0.95;
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.beginPath();
        g.roundRect(bx - 2, by - 2, bw + 4, 8, 4);
        g.fill();
        g.fillStyle = e > 0.5 ? P.healthy : e > 0.25 ? P.hungry : P.starving;
        g.beginPath();
        g.roundRect(bx, by, bw * e, 4, 2);
        g.fill();
      }
    }
    drawTreesUntil(Infinity);
  }

  /** night darkness 0–1 for a day fraction */
  static darkness(f: number): number {
    // dusk 0.62→0.74, night until 0.94, dawn 0.94→1.0/0.0→0.04
    if (f < 0.04) return 0.5 * (1 - f / 0.04);
    if (f < 0.62) return 0;
    if (f < 0.74) return (f - 0.62) / 0.12;
    if (f < 0.94) return 1;
    return 1 - ((f - 0.94) / 0.06) * 0.5;
  }

  private drawEnvironment(ox: number, oy: number, W: number, H: number): void {
    const w = this.world!;
    const g = this.g;
    const season = w.season();
    const ev = w.activeEvent?.kind;
    if (season === 3 || ev === 'winter') {
      g.fillStyle = 'rgba(235,245,255,0.22)';
      g.fillRect(ox, oy, W, H);
    } else if (season === 2) {
      g.fillStyle = 'rgba(240,160,80,0.08)';
      g.fillRect(ox, oy, W, H);
    }
    if (ev === 'drought') {
      g.fillStyle = 'rgba(250,200,90,0.14)';
      g.fillRect(ox, oy, W, H);
    }
    this.weatherFx.draw(g, this.cam.vw, this.cam.vh, this.time);
    const d = WorldRenderer.darkness(w.dayFrac);
    if (d > 0) {
      g.fillStyle = rgb(P.night, d * 0.38);
      g.fillRect(0, 0, this.cam.vw, this.cam.vh);
    }
  }

  private drawOverlay(ov: Overlay): void {
    if (!ov.hover) return;
    const g = this.g;
    const [sx, sy] = this.cam.toScreen(ov.hover[0], ov.hover[1]);
    const Z = this.cam.zoom;
    if (ov.tool === 'plant' || ov.tool === 'remove') {
      g.strokeStyle = ov.tool === 'plant' ? 'rgba(70,150,70,0.95)' : 'rgba(200,80,70,0.95)';
      g.fillStyle = ov.tool === 'plant' ? 'rgba(120,200,110,0.18)' : 'rgba(220,100,90,0.15)';
      g.lineWidth = 2;
      g.setLineDash([6, 4]);
      g.beginPath();
      g.arc(sx, sy, ov.brush * Z, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.setLineDash([]);
    } else if (ov.tool === 'rabbit' || ov.tool === 'wolf') {
      const img = ov.tool === 'rabbit' ? this.sprites.rabbit[0]! : this.sprites.wolf[0]!;
      const size = Z * (ov.tool === 'rabbit' ? 0.95 : 1.45);
      g.globalAlpha = 0.55;
      g.drawImage(img, sx - size * 0.45, sy - size * 0.78, size, size);
      g.globalAlpha = 1;
    } else if (ov.tool === 'inspect') {
      const tx = Math.floor(ov.hover[0]);
      const ty = Math.floor(ov.hover[1]);
      const [ax, ay] = this.cam.toScreen(tx, ty);
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 1.5;
      g.strokeRect(ax, ay, Z, Z);
    }
  }
}
