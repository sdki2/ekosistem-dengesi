import { PALETTE } from '../../content/palette';
import { STR, num } from '../../content/i18n';
import type { History } from '../../sim/stats';

/** canvas sized to its CSS box with devicePixelRatio */
export function fitCanvas(c: HTMLCanvasElement, cssH: number): { g: CanvasRenderingContext2D; w: number; h: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(10, c.clientWidth);
  const h = cssH;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.height = `${h}px`;
  }
  const g = c.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h };
}

function niceMax(v: number): number {
  if (v <= 10) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const FONT = '700 10px Nunito, system-ui, sans-serif';

// ───────────────────────── population line chart ─────────────────────────

export class PopulationChart {
  window: 'last50' | 'all' = 'last50';
  hoverX: number | null = null;
  constructor(public canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.hoverX = e.clientX - r.left;
    });
    canvas.addEventListener('pointerleave', () => (this.hoverX = null));
  }

  draw(hist: History): void {
    const { g, w, h } = fitCanvas(this.canvas, 170);
    g.clearRect(0, 0, w, h);
    const L = 34;
    const R = 30;
    const T = 8;
    const B = 18;
    const pw = w - L - R;
    const ph = h - T - B;
    const n = hist.t.length;
    if (n < 2) return;
    const tEnd = hist.t[n - 1]!;
    const tStart = this.window === 'last50' ? Math.max(0, tEnd - 50) : 0;
    let i0 = 0;
    while (i0 < n - 1 && hist.t[i0]! < tStart) i0++;
    const span = Math.max(1, tEnd - tStart);
    let maxA = 10;
    for (let i = i0; i < n; i++) maxA = Math.max(maxA, hist.rabbits[i]!, hist.wolves[i]! * 10);
    maxA = niceMax(maxA);
    const X = (t: number) => L + ((t - tStart) / span) * pw;
    const YA = (v: number) => T + ph - (v / maxA) * ph;
    const YP = (v: number) => T + ph - (v / 100) * ph;

    // grid
    g.strokeStyle = '#ece4cf';
    g.lineWidth = 1;
    g.font = FONT;
    g.fillStyle = '#8a8f86';
    for (let k = 0; k <= 4; k++) {
      const y = T + (ph * k) / 4;
      g.beginPath();
      g.moveTo(L, y);
      g.lineTo(L + pw, y);
      g.stroke();
      g.textAlign = 'right';
      g.fillText(num(maxA * (1 - k / 4)), L - 4, y + 3);
      g.textAlign = 'left';
      g.fillText(`%${100 - k * 25}`, L + pw + 4, y + 3);
    }
    // x labels
    g.textAlign = 'center';
    const step = span > 200 ? 50 : span > 80 ? 20 : 10;
    for (let d = Math.ceil(tStart / step) * step; d <= tEnd; d += step) g.fillText(String(d), X(d), h - 4);

    // stride for long histories
    const stride = Math.max(1, Math.floor((n - i0) / pw));

    // plants: filled area (right axis)
    g.beginPath();
    g.moveTo(X(hist.t[i0]!), YP(0));
    for (let i = i0; i < n; i += stride) g.lineTo(X(hist.t[i]!), YP(hist.plants[i]!));
    g.lineTo(X(hist.t[n - 1]!), YP(hist.plants[n - 1]!));
    g.lineTo(X(hist.t[n - 1]!), YP(0));
    g.closePath();
    g.fillStyle = 'rgba(95,174,90,0.18)';
    g.fill();
    const line = (arr: number[], mul: number, color: string, dash: number[], Y: (v: number) => number, width = 2.2) => {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.setLineDash(dash);
      g.beginPath();
      for (let i = i0; i < n; i += stride) {
        const x = X(hist.t[i]!);
        const y = Y(arr[i]! * mul);
        if (i === i0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.lineTo(X(hist.t[n - 1]!), Y(arr[n - 1]! * mul));
      g.stroke();
      g.setLineDash([]);
    };
    line(hist.plants, 1, PALETTE.seriesPlant, [2, 3], YP, 1.6);
    line(hist.rabbits, 1, PALETTE.seriesRabbit, [], YA);
    line(hist.wolves, 10, PALETTE.seriesWolf, [7, 4], YA);

    // hover readout
    if (this.hoverX !== null && this.hoverX >= L && this.hoverX <= L + pw) {
      const t = tStart + ((this.hoverX - L) / pw) * span;
      let k = i0;
      while (k < n - 1 && hist.t[k]! < t) k++;
      const x = X(hist.t[k]!);
      g.strokeStyle = 'rgba(58,66,62,0.4)';
      g.beginPath();
      g.moveTo(x, T);
      g.lineTo(x, T + ph);
      g.stroke();
      const lines = [
        `${STR.hud.day.replace('{n}', String(Math.floor(hist.t[k]!)))}`,
        `🐇 ${hist.rabbits[k]}   🐺 ${hist.wolves[k]}`,
        `🌱 %${hist.plants[k]!.toFixed(0)}`,
      ];
      const bw = 108;
      const bx = Math.min(x + 8, w - bw - 4);
      g.fillStyle = 'rgba(50,58,54,0.92)';
      g.beginPath();
      g.roundRect(bx, T + 4, bw, 46, 8);
      g.fill();
      g.fillStyle = '#fff';
      g.textAlign = 'left';
      g.font = '800 11px Nunito, system-ui, sans-serif';
      lines.forEach((s, j) => g.fillText(s, bx + 8, T + 18 + j * 13));
    }
  }
}

// ───────────────────────── food pyramid ─────────────────────────

export interface PyramidState {
  plants: number;
  rabbits: number;
  wolves: number;
}

export class PyramidChart {
  private cur = [0, 0, 0];
  inverted = false;
  warn = false;
  constructor(public canvas: HTMLCanvasElement) {}

  /** returns status: 'ok' | 'warn' | 'bad' */
  update(b: PyramidState, reduced: boolean): 'ok' | 'warn' | 'bad' {
    const vals = [b.plants, b.rabbits, b.wolves];
    const max = Math.max(1, ...vals);
    const target = vals.map((v) => (v <= 0 ? 0 : Math.max(0.06, Math.sqrt(v / max))));
    for (let k = 0; k < 3; k++) this.cur[k] = reduced ? target[k]! : this.cur[k]! + (target[k]! - this.cur[k]!) * 0.15;
    this.inverted = (b.wolves > b.rabbits && b.wolves > 0) || (b.rabbits > b.plants && b.rabbits > 0);
    this.warn = !this.inverted && b.wolves > b.rabbits * 0.6;
    this.draw(vals);
    return this.inverted ? 'bad' : this.warn ? 'warn' : 'ok';
  }

  private draw(vals: number[]): void {
    const { g, w, h } = fitCanvas(this.canvas, 150);
    g.clearRect(0, 0, w, h);
    const levels = [
      { color: '#8fcf7e', edge: '#5fae5a', icon: '🌱', label: STR.stats.producers },
      { color: '#e9c48f', edge: '#c98b4e', icon: '🐇', label: STR.stats.primary },
      { color: '#a9bcdc', edge: '#5f7fae', icon: '🐺', label: STR.stats.secondary },
    ];
    const lh = (h - 12) / 3;
    const cx = w * 0.36;
    const maxW = w * 0.66;
    g.font = '800 11px Nunito, system-ui, sans-serif';
    for (let k = 0; k < 3; k++) {
      const y = h - 6 - (k + 1) * lh;
      const bw = this.cur[k]! * maxW;
      const bad = (k === 2 && vals[2]! > vals[1]! && vals[2]! > 0) || (k === 1 && vals[1]! > vals[0]! && vals[1]! > 0);
      g.fillStyle = levels[k]!.color;
      g.strokeStyle = bad ? PALETTE.starving : levels[k]!.edge;
      g.lineWidth = bad ? 3 : 1.5;
      g.beginPath();
      g.roundRect(cx - bw / 2, y + 3, Math.max(4, bw), lh - 6, 7);
      g.fill();
      g.stroke();
      g.fillStyle = '#3a423e';
      g.textAlign = 'left';
      g.fillText(`${levels[k]!.icon} ${num(vals[k]!)}`, w * 0.72, y + lh / 2 + 4);
      if (bad) {
        g.fillStyle = PALETTE.starving;
        g.fillText('⚠', cx - bw / 2 - 16, y + lh / 2 + 4);
      }
    }
  }
}

// ───────────────────────── phase plot ─────────────────────────

export class PhasePlot {
  constructor(public canvas: HTMLCanvasElement) {}

  draw(hist: History): void {
    const { g, w, h } = fitCanvas(this.canvas, 170);
    g.clearRect(0, 0, w, h);
    const n = hist.t.length;
    if (n < 2) return;
    const L = 32;
    const B = 22;
    const T = 8;
    const R = 8;
    const start = Math.max(0, n - 4 * 150); // last 150 days
    let mx = 10;
    let my = 4;
    for (let i = start; i < n; i++) {
      mx = Math.max(mx, hist.rabbits[i]!);
      my = Math.max(my, hist.wolves[i]!);
    }
    mx = niceMax(mx);
    my = niceMax(my);
    const X = (v: number) => L + (v / mx) * (w - L - R);
    const Y = (v: number) => h - B - (v / my) * (h - B - T);
    g.strokeStyle = '#ece4cf';
    g.strokeRect(L, T, w - L - R, h - B - T);
    g.font = FONT;
    g.fillStyle = '#8a8f86';
    g.textAlign = 'center';
    g.fillText(`🐇 ${STR.species.rabbits} (0–${num(mx)})`, L + (w - L - R) / 2, h - 5);
    g.save();
    g.translate(10, T + (h - B - T) / 2);
    g.rotate(-Math.PI / 2);
    g.fillText(`🐺 0–${num(my)}`, 0, 0);
    g.restore();
    g.lineWidth = 1.6;
    for (let i = start + 1; i < n; i++) {
      const a = (i - start) / (n - start);
      g.strokeStyle = `rgba(95,127,174,${0.08 + a * 0.8})`;
      g.beginPath();
      g.moveTo(X(hist.rabbits[i - 1]!), Y(hist.wolves[i - 1]!));
      g.lineTo(X(hist.rabbits[i]!), Y(hist.wolves[i]!));
      g.stroke();
    }
    g.fillStyle = PALETTE.seriesRabbit;
    g.beginPath();
    g.arc(X(hist.rabbits[n - 1]!), Y(hist.wolves[n - 1]!), 5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.stroke();
  }
}

/** small static chart for the collapse / summary modals */
export function drawMiniHistory(c: HTMLCanvasElement, hist: History): void {
  const chart = new PopulationChart(c);
  chart.window = 'all';
  // fit uses clientWidth; defer until in DOM
  requestAnimationFrame(() => chart.draw(hist));
}
