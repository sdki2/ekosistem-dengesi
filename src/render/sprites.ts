import { PALETTE as P, rgb, type RGB } from '../content/palette';

/** Procedurally drawn sprite frames, pre-rendered once to offscreen canvases. */

export type Canvas = HTMLCanvasElement;

function canvas(w: number, h: number): [Canvas, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function shade(c: RGB, k: number): RGB {
  return [c[0] * k, c[1] * k, c[2] * k];
}

export const RABBIT_FRAMES = 6;
export const WOLF_FRAMES = 6;

export interface SpriteSet {
  /** rabbit frames: 0..5 hop cycle, 6 sleep, 7 alert (ears up) */
  rabbit: Canvas[];
  rabbitSize: number;
  /** wolf frames: 0..5 trot, 6 rest */
  wolf: Canvas[];
  wolfSize: number;
  /** deer frames: 0..5 walk, 6 rest */
  deer: Canvas[];
  /** trees[kind][season]: oak, round oak, birch, pine, spruce, cherry × spring..winter */
  trees: Canvas[][];
  /** fox / bear frames: 0..5 walk, 6 rest */
  fox: Canvas[];
  bear: Canvas[];
  treeSize: number;
  bushes: Canvas[];
  bushSize: number;
  /** tufts[variant][swayFrame] */
  tufts: Canvas[][];
  tuftSize: number;
  shadow: Canvas;
}

// ───────────────────────── rabbit ─────────────────────────

function drawRabbit(f: number): Canvas {
  const S = 64;
  const [c, g] = canvas(S, S);
  const sleep = f === 6;
  const alert = f === 7;
  const t = (f / RABBIT_FRAMES) * Math.PI * 2;
  const stretch = sleep ? 0 : Math.max(0, Math.sin(t)); // hop extension
  const bodyY = sleep ? 0.66 : 0.6 - stretch * 0.02;

  // back foot
  g.fillStyle = rgb(P.furShade);
  ellipse(g, S * (0.33 - stretch * 0.05), S * 0.76, S * (0.11 + stretch * 0.05), S * 0.05);
  g.fill();
  // tail
  g.fillStyle = '#fffaf2';
  ellipse(g, S * 0.21, S * (bodyY - 0.04), S * 0.075, S * 0.07);
  g.fill();
  // body
  const grad = g.createLinearGradient(0, S * (bodyY - 0.2), 0, S * (bodyY + 0.2));
  grad.addColorStop(0, rgb(P.fur));
  grad.addColorStop(1, rgb(P.furShade));
  g.fillStyle = grad;
  ellipse(g, S * 0.44, S * bodyY, S * (0.23 + stretch * 0.03), S * (sleep ? 0.16 : 0.18), sleep ? 0 : -0.08);
  g.fill();
  // front paw
  if (!sleep) {
    g.fillStyle = rgb(P.furShade);
    ellipse(g, S * (0.58 + stretch * 0.06), S * 0.77, S * 0.06, S * 0.04);
    g.fill();
  }
  // ears
  const headX = S * (sleep ? 0.66 : 0.67);
  const headY = S * (sleep ? 0.6 : 0.46);
  const wig = sleep ? 0 : Math.sin(t * 2) * 0.12;
  const earBase = sleep ? 1.15 : alert ? -1.45 : -1.25;
  for (const [dx, extra] of [[-0.03, -0.12], [0.03, 0.05]] as const) {
    const ang = earBase + extra + wig;
    const ex = headX + S * dx + Math.cos(ang) * S * 0.12;
    const ey = headY - S * 0.04 + Math.sin(ang) * S * 0.12;
    g.fillStyle = rgb(dx < 0 ? P.furShade : P.fur);
    ellipse(g, ex, ey, S * 0.14, S * 0.05, ang);
    g.fill();
    g.fillStyle = rgb(P.earIn);
    ellipse(g, ex, ey, S * 0.1, S * 0.025, ang);
    g.fill();
  }
  // head
  g.fillStyle = rgb(P.fur);
  ellipse(g, headX, headY, S * 0.13, S * 0.12);
  g.fill();
  // cheek blush
  g.fillStyle = 'rgba(244,160,170,0.45)';
  ellipse(g, headX + S * 0.04, headY + S * 0.05, S * 0.04, S * 0.025);
  g.fill();
  // eye
  if (sleep) {
    g.strokeStyle = rgb(P.ink);
    g.lineWidth = S * 0.018;
    g.beginPath();
    g.arc(headX + S * 0.05, headY - S * 0.005, S * 0.025, 0.2, Math.PI - 0.2);
    g.stroke();
  } else {
    g.fillStyle = rgb(P.ink);
    ellipse(g, headX + S * 0.055, headY - S * 0.01, S * 0.022, S * 0.026);
    g.fill();
    g.fillStyle = '#fff';
    ellipse(g, headX + S * 0.062, headY - S * 0.02, S * 0.008, S * 0.008);
    g.fill();
  }
  // nose
  g.fillStyle = '#e88f9a';
  ellipse(g, headX + S * 0.125, headY + S * 0.015, S * 0.016, S * 0.012);
  g.fill();
  return c;
}

// ───────────────────────── deer ─────────────────────────

const DEER_FRAMES = 6;
export { DEER_FRAMES };

function drawDeer(f: number): Canvas {
  const S = 96;
  const [c, g] = canvas(S, S);
  const rest = f === 6;
  const t = (f / DEER_FRAMES) * Math.PI * 2;
  const bob = rest ? 0 : Math.abs(Math.sin(t)) * S * 0.014;
  const fur: RGB = [196, 150, 104];
  const furDark: RGB = [150, 108, 70];
  const belly: RGB = [236, 220, 192];
  const by = S * (rest ? 0.6 : 0.46) - bob;

  // legs (far pair darker)
  if (!rest) {
    const legs: [number, number, boolean][] = [
      [0.3, Math.sin(t), true],
      [0.62, Math.sin(t + Math.PI), true],
      [0.34, Math.sin(t + Math.PI), false],
      [0.66, Math.sin(t), false],
    ];
    for (const [lx, s, far] of legs) {
      g.save();
      g.translate(S * lx, by + S * 0.05);
      g.rotate(s * 0.4);
      g.fillStyle = rgb(far ? furDark : shade(fur, 0.9));
      g.beginPath();
      g.roundRect(-S * 0.018, 0, S * 0.036, S * 0.3, S * 0.015);
      g.fill();
      g.restore();
    }
  } else {
    g.fillStyle = rgb(furDark);
    g.beginPath();
    g.ellipse(S * 0.42, by + S * 0.2, S * 0.2, S * 0.04, 0, 0, Math.PI * 2);
    g.fill();
  }

  // body
  const grad = g.createLinearGradient(0, by - S * 0.1, 0, by + S * 0.14);
  grad.addColorStop(0, rgb(shade(fur, 1.06)));
  grad.addColorStop(1, rgb(furDark));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(S * 0.46, by, S * 0.27, S * 0.13, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = rgb(belly, 0.85);
  g.beginPath();
  g.ellipse(S * 0.46, by + S * 0.07, S * 0.2, S * 0.06, 0, 0, Math.PI * 2);
  g.fill();
  // spots
  g.fillStyle = 'rgba(255,248,230,0.7)';
  for (const [sx, sy] of [[0.38, -0.05], [0.48, -0.07], [0.56, -0.02], [0.43, 0.01]] as const) {
    g.beginPath();
    g.arc(S * sx, by + S * sy, S * 0.014, 0, Math.PI * 2);
    g.fill();
  }
  // tail
  g.fillStyle = rgb(belly);
  g.beginPath();
  g.ellipse(S * 0.2, by - S * 0.04, S * 0.028, S * 0.04, -0.5, 0, Math.PI * 2);
  g.fill();

  // neck + head (facing right)
  const hx = S * 0.76;
  const hy = by - S * (rest ? 0.12 : 0.17) + bob * 0.3;
  g.fillStyle = rgb(shade(fur, 1.02));
  g.beginPath();
  g.moveTo(S * 0.62, by - S * 0.06);
  g.lineTo(hx - S * 0.02, hy + S * 0.05);
  g.lineTo(hx + S * 0.03, hy + S * 0.09);
  g.lineTo(S * 0.68, by + S * 0.05);
  g.closePath();
  g.fill();
  g.beginPath();
  g.ellipse(hx + S * 0.03, hy + S * 0.04, S * 0.075, S * 0.05, 0.25, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = rgb(furDark);
  g.beginPath();
  g.ellipse(hx + S * 0.1, hy + S * 0.06, S * 0.03, S * 0.022, 0.25, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2b2118';
  g.beginPath();
  g.arc(hx + S * 0.04, hy + S * 0.02, S * 0.01, 0, Math.PI * 2);
  g.fill();
  // ear
  g.fillStyle = rgb(furDark);
  g.beginPath();
  g.ellipse(hx - S * 0.02, hy - S * 0.01, S * 0.016, S * 0.035, -0.5, 0, Math.PI * 2);
  g.fill();
  // antlers
  g.strokeStyle = '#8b6a45';
  g.lineWidth = S * 0.012;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(hx + S * 0.01, hy - S * 0.01);
  g.lineTo(hx - S * 0.02, hy - S * 0.1);
  g.moveTo(hx - S * 0.012, hy - S * 0.06);
  g.lineTo(hx + S * 0.025, hy - S * 0.1);
  g.moveTo(hx + S * 0.02, hy - S * 0.01);
  g.lineTo(hx + S * 0.05, hy - S * 0.09);
  g.stroke();
  return c;
}

// ───────────────────────── wolf ─────────────────────────

function drawWolf(f: number): Canvas {
  const S = 96;
  const [c, g] = canvas(S, S);
  const rest = f === 6;
  const t = (f / WOLF_FRAMES) * Math.PI * 2;
  const bob = rest ? 0 : Math.abs(Math.sin(t)) * S * 0.012;
  const by = S * (rest ? 0.62 : 0.5) - bob;

  // legs (far pair darker)
  if (!rest) {
    const legs: [number, number, boolean][] = [
      [0.3, Math.sin(t), true],
      [0.58, Math.sin(t + Math.PI), true],
      [0.34, Math.sin(t + Math.PI), false],
      [0.62, Math.sin(t), false],
    ].map(([x, s, far]) => [x as number, s as number, far as boolean]);
    for (const [lx, s, far] of legs) {
      g.save();
      g.translate(S * lx, by + S * 0.06);
      g.rotate(s * 0.45);
      g.fillStyle = rgb(far ? P.wolfDark : shade(P.wolf, 0.92));
      g.beginPath();
      g.roundRect(-S * 0.03, 0, S * 0.06, S * 0.2, S * 0.03);
      g.fill();
      g.restore();
    }
  }
  // tail
  g.save();
  g.translate(S * 0.2, by - S * 0.02);
  g.rotate(rest ? 0.5 : 0.6 + Math.sin(t) * 0.12);
  g.fillStyle = rgb(P.wolf);
  ellipse(g, -S * 0.08, 0, S * 0.12, S * 0.05);
  g.fill();
  g.fillStyle = rgb(P.wolfLight);
  ellipse(g, -S * 0.17, S * 0.005, S * 0.04, S * 0.03);
  g.fill();
  g.restore();
  // body
  const grad = g.createLinearGradient(0, by - S * 0.13, 0, by + S * 0.13);
  grad.addColorStop(0, rgb(shade(P.wolf, 1.05)));
  grad.addColorStop(1, rgb(P.wolfDark));
  g.fillStyle = grad;
  ellipse(g, S * 0.45, by, S * 0.25, S * (rest ? 0.11 : 0.13));
  g.fill();
  // belly / chest
  g.fillStyle = rgb(P.wolfLight, 0.9);
  ellipse(g, S * 0.58, by + S * 0.06, S * 0.1, S * 0.05);
  g.fill();
  // head
  const hx = S * (rest ? 0.72 : 0.72);
  const hy = rest ? by + S * 0.02 : by - S * 0.1;
  // ears
  g.fillStyle = rgb(P.wolfDark);
  for (const ox of [-0.04, 0.02]) {
    g.beginPath();
    g.moveTo(hx + S * ox, hy - S * 0.06);
    g.lineTo(hx + S * (ox + 0.025), hy - S * 0.15);
    g.lineTo(hx + S * (ox + 0.06), hy - S * 0.05);
    g.closePath();
    g.fill();
  }
  g.fillStyle = rgb(P.wolf);
  ellipse(g, hx, hy, S * 0.1, S * 0.085);
  g.fill();
  // snout
  g.fillStyle = rgb(P.wolfLight);
  ellipse(g, hx + S * 0.09, hy + S * 0.03, S * 0.07, S * 0.04);
  g.fill();
  g.fillStyle = rgb(P.ink);
  ellipse(g, hx + S * 0.155, hy + S * 0.02, S * 0.018, S * 0.014);
  g.fill();
  // eye
  if (rest) {
    g.strokeStyle = rgb(P.ink);
    g.lineWidth = S * 0.012;
    g.beginPath();
    g.arc(hx + S * 0.03, hy - S * 0.01, S * 0.018, 0.2, Math.PI - 0.2);
    g.stroke();
  } else {
    g.fillStyle = rgb(P.ink);
    ellipse(g, hx + S * 0.035, hy - S * 0.015, S * 0.016, S * 0.018);
    g.fill();
    g.fillStyle = '#fff';
    ellipse(g, hx + S * 0.04, hy - S * 0.022, S * 0.006, S * 0.006);
    g.fill();
  }
  return c;
}

// ───────────────────────── plants ─────────────────────────

function drawBush(v: number): Canvas {
  const S = 48;
  const [c, g] = canvas(S, S);
  const rnd = mulberry(v * 97 + 3);
  for (let k = 0; k < 5; k++) {
    const x = 0.25 + rnd() * 0.5;
    const y = 0.4 + rnd() * 0.3;
    const r = 0.16 + rnd() * 0.1;
    const gr = g.createRadialGradient(S * (x - 0.05), S * (y - 0.08), 1, S * x, S * y, S * r);
    gr.addColorStop(0, rgb(P.bushLight));
    gr.addColorStop(1, rgb(P.bush));
    g.fillStyle = gr;
    ellipse(g, S * x, S * y, S * r, S * r * 0.85);
    g.fill();
  }
  if (v % 2 === 0) {
    g.fillStyle = rgb(P.berry);
    for (let k = 0; k < 4; k++) {
      ellipse(g, S * (0.3 + rnd() * 0.4), S * (0.4 + rnd() * 0.25), S * 0.03, S * 0.03);
      g.fill();
    }
  }
  return c;
}

function drawTuft(v: number, sway: number): Canvas {
  const S = 32;
  const [c, g] = canvas(S, S);
  const rnd = mulberry(v * 31 + 7);
  g.lineCap = 'round';
  const blades = 4 + (v % 3);
  for (let k = 0; k < blades; k++) {
    const bx = S * (0.3 + rnd() * 0.4);
    const h = S * (0.35 + rnd() * 0.3);
    const lean = (rnd() - 0.5) * 0.5 + sway * 0.25;
    g.strokeStyle = rgb(k % 2 ? P.leafDark : P.leaf, 0.85);
    g.lineWidth = S * 0.06;
    g.beginPath();
    g.moveTo(bx, S * 0.9);
    g.quadraticCurveTo(bx + lean * S * 0.2, S * 0.9 - h * 0.6, bx + lean * S * 0.45, S * 0.9 - h);
    g.stroke();
  }
  if (v === 2 || v === 4) {
    const fc = P.flower[v % P.flower.length]!;
    g.fillStyle = rgb(fc);
    ellipse(g, S * (0.5 + sway * 0.08), S * 0.38, S * 0.07, S * 0.07);
    g.fill();
    g.fillStyle = '#f7d36a';
    ellipse(g, S * (0.5 + sway * 0.08), S * 0.38, S * 0.025, S * 0.025);
    g.fill();
  }
  return c;
}

function drawShadow(): Canvas {
  const S = 32;
  const [c, g] = canvas(S, S / 2);
  const gr = g.createRadialGradient(S / 2, S / 4, 1, S / 2, S / 4, S / 2);
  gr.addColorStop(0, 'rgba(40,50,40,0.35)');
  gr.addColorStop(1, 'rgba(40,50,40,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S / 2);
  return c;
}

export function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let cached: SpriteSet | null = null;

export function getSprites(): SpriteSet {
  if (cached) return cached;
  cached = {
    rabbit: Array.from({ length: 8 }, (_, f) => drawRabbit(f)),
    rabbitSize: 64,
    wolf: Array.from({ length: 7 }, (_, f) => drawWolf(f)),
    wolfSize: 96,
    deer: Array.from({ length: 7 }, (_, f) => drawDeer(f)),
    trees: Array.from({ length: TREE_KINDS }, (_, k) => [0, 1, 2, 3].map((s) => drawTreeKind(k, s))),
    fox: Array.from({ length: 7 }, (_, f) => drawFox(f)),
    bear: Array.from({ length: 7 }, (_, f) => drawBear(f)),
    treeSize: 96,
    bushes: [0, 1, 2, 3].map(drawBush),
    bushSize: 48,
    tufts: [0, 1, 2, 3, 4].map((v) => [-1, 0, 1].map((s) => drawTuft(v, s))),
    tuftSize: 32,
    shadow: drawShadow(),
  };
  return cached;
}

// ───────────────────────── trees: six kinds × four seasons ─────────────────────────

/** 0 oak, 1 round oak, 2 birch, 3 pine, 4 spruce, 5 cherry */
export const TREE_KINDS = 6;

function crown(g: CanvasRenderingContext2D, S: number, blobs: [number, number, number][], light: RGB, base: RGB): void {
  for (const [x, y, r] of blobs) {
    const gr = g.createRadialGradient(S * (x - r * 0.3), S * (y - r * 0.4), S * r * 0.1, S * x, S * y, S * r);
    gr.addColorStop(0, rgb(light));
    gr.addColorStop(1, rgb(base));
    g.fillStyle = gr;
    ellipse(g, S * x, S * y, S * r, S * r * 0.95);
    g.fill();
  }
}

function bareBranches(g: CanvasRenderingContext2D, S: number, col: string, top: number): void {
  g.strokeStyle = col;
  g.lineCap = 'round';
  const branch = (x: number, y: number, ang: number, len: number, wdt: number, depth: number) => {
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    g.lineWidth = wdt;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x2, y2);
    g.stroke();
    if (depth > 0) {
      branch(x2, y2, ang - 0.45, len * 0.7, wdt * 0.65, depth - 1);
      branch(x2, y2, ang + 0.4, len * 0.68, wdt * 0.65, depth - 1);
    }
  };
  branch(S * 0.5, S * 0.62, -Math.PI / 2, S * (0.62 - top) * 0.55, S * 0.05, 3);
}

function snowCaps(g: CanvasRenderingContext2D, S: number, spots: [number, number, number][]): void {
  g.fillStyle = 'rgba(250,252,255,0.95)';
  for (const [x, y, r] of spots) {
    ellipse(g, S * x, S * y, S * r, S * r * 0.45);
    g.fill();
  }
}

function drawTreeKind(kind: number, season: number): Canvas {
  const S = 96;
  const [c, g] = canvas(S, S);
  const winter = season === 3;
  const autumn = season === 2;
  const spring = season === 0;

  if (kind === 3 || kind === 4) {
    // conifers keep their needles all year
    g.fillStyle = rgb(P.trunk);
    g.fillRect(S * 0.46, S * 0.7, S * 0.08, S * 0.22);
    const tall = kind === 4;
    const tiers = tall ? 4 : 3;
    const dark: RGB = tall ? [52, 98, 72] : [62, 116, 78];
    const light: RGB = tall ? [88, 140, 104] : [104, 160, 108];
    for (let t = 0; t < tiers; t++) {
      const y0 = S * (tall ? 0.06 : 0.14) + t * S * (tall ? 0.16 : 0.18);
      const half = S * (0.14 + t * (tall ? 0.06 : 0.08));
      const gr = g.createLinearGradient(S * 0.5 - half, 0, S * 0.5 + half, 0);
      gr.addColorStop(0, rgb(light));
      gr.addColorStop(1, rgb(dark));
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(S * 0.5, y0);
      g.lineTo(S * 0.5 + half, y0 + S * (tall ? 0.24 : 0.26));
      g.lineTo(S * 0.5 - half, y0 + S * (tall ? 0.24 : 0.26));
      g.closePath();
      g.fill();
      if (winter) {
        g.fillStyle = 'rgba(250,252,255,0.92)';
        g.beginPath();
        g.moveTo(S * 0.5, y0);
        g.lineTo(S * 0.5 + half * 0.55, y0 + S * 0.12);
        g.lineTo(S * 0.5 - half * 0.55, y0 + S * 0.12);
        g.closePath();
        g.fill();
      }
    }
    return c;
  }

  // deciduous: trunk first
  const birch = kind === 2;
  g.fillStyle = birch ? '#efece4' : rgb(P.trunk);
  g.beginPath();
  g.roundRect(S * (birch ? 0.47 : 0.45), S * 0.5, S * (birch ? 0.06 : 0.1), S * 0.4, S * 0.03);
  g.fill();
  if (birch) {
    g.fillStyle = '#3a3a3a';
    for (const y of [0.56, 0.66, 0.74, 0.83]) g.fillRect(S * 0.47, S * y, S * 0.035, S * 0.012);
  }

  if (winter) {
    bareBranches(g, S, birch ? '#e6e2d8' : '#7a5a3e', 0.18);
    snowCaps(g, S, [[0.42, 0.34, 0.08], [0.58, 0.3, 0.07], [0.5, 0.22, 0.06]]);
    return c;
  }

  const shapes: [number, number, number][][] = [
    [[0.5, 0.42, 0.26], [0.33, 0.5, 0.17], [0.67, 0.5, 0.17], [0.5, 0.26, 0.17]],
    [[0.5, 0.4, 0.28], [0.3, 0.46, 0.15], [0.7, 0.44, 0.16]],
    [[0.5, 0.36, 0.17], [0.42, 0.24, 0.12], [0.58, 0.3, 0.12], [0.5, 0.48, 0.13]],
    [],
    [],
    [[0.46, 0.44, 0.22], [0.62, 0.38, 0.2], [0.4, 0.3, 0.15], [0.66, 0.54, 0.13]],
  ];
  let base: RGB;
  let light: RGB;
  if (autumn) {
    const autumnCols: [RGB, RGB][] = [[[214, 120, 52], [246, 186, 92]], [[196, 82, 54], [236, 146, 90]], [[226, 182, 62], [250, 224, 120]], [[0, 0, 0], [0, 0, 0]], [[0, 0, 0], [0, 0, 0]], [[200, 96, 70], [240, 160, 110]]];
    [base, light] = autumnCols[kind]!;
  } else if (birch) {
    base = [118, 164, 82];
    light = [176, 206, 120];
  } else if (spring) {
    base = [104, 172, 92];
    light = [172, 220, 140];
  } else {
    base = kind === 1 ? P.leafDark : P.leaf;
    light = P.leafLight;
  }
  crown(g, S, shapes[kind]!, light, base);
  // cherry blossom in spring, berries/fruit in late summer
  if (kind === 5 && spring) {
    g.fillStyle = 'rgba(250,190,214,0.95)';
    const r = mulberry(kind * 31 + 7);
    for (let k = 0; k < 26; k++) {
      ellipse(g, S * (0.3 + r() * 0.42), S * (0.22 + r() * 0.38), S * 0.025, S * 0.022);
      g.fill();
    }
  } else if (kind === 5 && season === 1) {
    g.fillStyle = '#c0392b';
    const r = mulberry(kind * 17 + 3);
    for (let k = 0; k < 10; k++) {
      ellipse(g, S * (0.32 + r() * 0.38), S * (0.28 + r() * 0.32), S * 0.018, S * 0.018);
      g.fill();
    }
  }
  return c;
}

// ───────────────────────── fox ─────────────────────────

export const FOX_FRAMES = 6;

function drawFox(f: number): Canvas {
  const S = 64;
  const [c, g] = canvas(S, S);
  const rest = f === 6;
  const t = (f / FOX_FRAMES) * Math.PI * 2;
  const by = S * (rest ? 0.66 : 0.56) - (rest ? 0 : Math.abs(Math.sin(t)) * S * 0.02);
  const fur: RGB = [222, 120, 52];
  const furDark: RGB = [176, 86, 34];
  if (!rest) {
    for (const [lx, s] of [[0.36, Math.sin(t)], [0.6, Math.sin(t + Math.PI)], [0.4, Math.sin(t + Math.PI)], [0.64, Math.sin(t)]] as const) {
      g.save();
      g.translate(S * lx, by + S * 0.05);
      g.rotate(s * 0.45);
      g.fillStyle = '#3b2a22';
      g.fillRect(-S * 0.018, 0, S * 0.036, S * 0.18);
      g.restore();
    }
  }
  // brush tail with white tip
  g.fillStyle = rgb(fur);
  g.beginPath();
  g.ellipse(S * 0.2, by - S * (rest ? 0.0 : 0.04), S * 0.17, S * 0.07, rest ? 0.2 : -0.35, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fbf6ee';
  g.beginPath();
  g.ellipse(S * 0.07, by + S * (rest ? 0.02 : 0.02), S * 0.05, S * 0.04, -0.3, 0, Math.PI * 2);
  g.fill();
  // body
  const grad = g.createLinearGradient(0, by - S * 0.08, 0, by + S * 0.1);
  grad.addColorStop(0, rgb(shade(fur, 1.06)));
  grad.addColorStop(1, rgb(furDark));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(S * 0.48, by, S * 0.2, S * 0.1, 0, 0, Math.PI * 2);
  g.fill();
  // head
  const hx = S * 0.72;
  const hy = by - S * (rest ? 0.04 : 0.08);
  g.fillStyle = rgb(fur);
  g.beginPath();
  g.ellipse(hx, hy, S * 0.1, S * 0.08, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(hx + S * 0.06, hy - S * 0.02);
  g.lineTo(hx + S * 0.19, hy + S * 0.03);
  g.lineTo(hx + S * 0.05, hy + S * 0.06);
  g.closePath();
  g.fill();
  g.fillStyle = '#fbf6ee';
  g.beginPath();
  g.ellipse(hx + S * 0.07, hy + S * 0.045, S * 0.07, S * 0.025, 0.15, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2b1d16';
  g.beginPath();
  g.arc(hx + S * 0.185, hy + S * 0.03, S * 0.015, 0, Math.PI * 2);
  g.fill();
  if (!rest) {
    g.beginPath();
    g.arc(hx + S * 0.04, hy - S * 0.015, S * 0.012, 0, Math.PI * 2);
    g.fill();
  }
  // ears
  g.fillStyle = rgb(furDark);
  for (const ex of [-0.04, 0.03]) {
    g.beginPath();
    g.moveTo(hx + S * ex - S * 0.03, hy - S * 0.05);
    g.lineTo(hx + S * ex, hy - S * 0.15);
    g.lineTo(hx + S * ex + S * 0.03, hy - S * 0.05);
    g.closePath();
    g.fill();
  }
  return c;
}

// ───────────────────────── bear ─────────────────────────

export const BEAR_FRAMES = 6;

function drawBear(f: number): Canvas {
  const S = 112;
  const [c, g] = canvas(S, S);
  const rest = f === 6;
  const t = (f / BEAR_FRAMES) * Math.PI * 2;
  const fur: RGB = [122, 84, 56];
  const furDark: RGB = [86, 58, 40];
  const by = S * (rest ? 0.64 : 0.52) - (rest ? 0 : Math.abs(Math.sin(t)) * S * 0.01);
  if (!rest) {
    for (const [lx, s, far] of [[0.3, Math.sin(t), true], [0.62, Math.sin(t + Math.PI), true], [0.34, Math.sin(t + Math.PI), false], [0.66, Math.sin(t), false]] as const) {
      g.save();
      g.translate(S * lx, by + S * 0.06);
      g.rotate(s * 0.3);
      g.fillStyle = rgb(far ? furDark : shade(fur, 0.9));
      g.beginPath();
      g.roundRect(-S * 0.045, 0, S * 0.09, S * 0.2, S * 0.03);
      g.fill();
      g.restore();
    }
  }
  const grad = g.createRadialGradient(S * 0.45, by - S * 0.08, S * 0.04, S * 0.48, by, S * 0.3);
  grad.addColorStop(0, rgb(shade(fur, 1.12)));
  grad.addColorStop(1, rgb(furDark));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(S * 0.48, by, S * 0.28, S * (rest ? 0.13 : 0.16), 0, 0, Math.PI * 2);
  g.fill();
  // shoulder hump
  g.beginPath();
  g.ellipse(S * 0.6, by - S * 0.1, S * 0.12, S * 0.08, 0, 0, Math.PI * 2);
  g.fill();
  // head
  const hx = S * (rest ? 0.76 : 0.78);
  const hy = by - S * (rest ? 0.02 : 0.06);
  g.fillStyle = rgb(fur);
  g.beginPath();
  g.ellipse(hx, hy, S * 0.11, S * 0.1, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = rgb([196, 160, 120]);
  g.beginPath();
  g.ellipse(hx + S * 0.08, hy + S * 0.025, S * 0.055, S * 0.045, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#21160f';
  g.beginPath();
  g.arc(hx + S * 0.125, hy + S * 0.015, S * 0.018, 0, Math.PI * 2);
  g.fill();
  if (!rest) {
    g.beginPath();
    g.arc(hx + S * 0.02, hy - S * 0.03, S * 0.012, 0, Math.PI * 2);
    g.fill();
  } else {
    g.strokeStyle = '#21160f';
    g.lineWidth = S * 0.008;
    g.beginPath();
    g.arc(hx + S * 0.02, hy - S * 0.03, S * 0.012, 0, Math.PI);
    g.stroke();
  }
  g.fillStyle = rgb(furDark);
  for (const ex of [-0.07, 0.03]) {
    g.beginPath();
    g.arc(hx + S * ex, hy - S * 0.085, S * 0.03, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}
