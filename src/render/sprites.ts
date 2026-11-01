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
  trees: Canvas[];
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

function drawTree(v: number): Canvas {
  const S = 96;
  const [c, g] = canvas(S, S);
  // trunk
  g.fillStyle = rgb(P.trunk);
  g.beginPath();
  g.roundRect(S * 0.45, S * 0.55, S * 0.1, S * 0.35, S * 0.03);
  g.fill();
  const blobs: [number, number, number][][] = [
    [[0.5, 0.42, 0.26], [0.33, 0.5, 0.17], [0.67, 0.5, 0.17], [0.5, 0.26, 0.17]],
    [[0.5, 0.4, 0.28], [0.3, 0.46, 0.15], [0.7, 0.44, 0.16]],
    [[0.46, 0.44, 0.22], [0.62, 0.38, 0.2], [0.4, 0.3, 0.15], [0.66, 0.54, 0.13]],
  ];
  const base = [P.leaf, P.leafDark, P.leaf][v % 3]!;
  for (const [x, y, r] of blobs[v % 3]!) {
    const gr = g.createRadialGradient(S * (x - r * 0.3), S * (y - r * 0.4), S * r * 0.1, S * x, S * y, S * r);
    gr.addColorStop(0, rgb(P.leafLight));
    gr.addColorStop(1, rgb(base));
    g.fillStyle = gr;
    ellipse(g, S * x, S * y, S * r, S * r * 0.95);
    g.fill();
  }
  return c;
}

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
    trees: [0, 1, 2].map(drawTree),
    treeSize: 96,
    bushes: [0, 1, 2, 3].map(drawBush),
    bushSize: 48,
    tufts: [0, 1, 2, 3, 4].map((v) => [-1, 0, 1].map((s) => drawTuft(v, s))),
    tuftSize: 32,
    shadow: drawShadow(),
  };
  return cached;
}
