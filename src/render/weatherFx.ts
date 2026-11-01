import { Wx } from '../sim/weather';

/** cheap deterministic hash → [0,1) so precipitation needs no per-drop state */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const MAX_DROPS = 260;
const MAX_FLAKES = 110;

/**
 * Screen-space weather: cloud shade, rain, snow, fog, heat haze, lightning.
 * Purely visual; each weather kind fades in and out (`level[kind]` 0–1).
 */
export class WeatherFx {
  private level = new Float32Array(7);
  reducedMotion = false;
  /** lightning flash 0–1, set by the sim's lightning events */
  flash = 0;

  update(kind: Wx | null, dt: number): void {
    this.flash = Math.max(0, this.flash - dt * 3.2);
    const k = Math.min(1, dt * 0.6);
    for (let i = 0; i < this.level.length; i++) {
      const target = kind === i ? 1 : 0;
      this.level[i] = this.level[i]! + (target - this.level[i]!) * k;
      if (this.level[i]! < 0.003) this.level[i] = 0;
    }
  }

  /** 0–1 how overcast the sky is (used to dim sun and tint the world) */
  get overcast(): number {
    const L = this.level;
    return Math.min(1, L[Wx.Cloudy]! * 0.35 + L[Wx.Rain]! * 0.6 + L[Wx.Storm]! + L[Wx.Snow]! * 0.4 + L[Wx.Fog]! * 0.3);
  }

  draw(g: CanvasRenderingContext2D, W: number, H: number, time: number): void {
    const L = this.level;
    const still = this.reducedMotion;

    // cloud shade
    const shade = L[Wx.Cloudy]! * 0.09 + L[Wx.Rain]! * 0.17 + L[Wx.Storm]! * 0.32 + L[Wx.Snow]! * 0.08;
    if (shade > 0.004) {
      g.fillStyle = `rgba(78,92,118,${shade.toFixed(3)})`;
      g.fillRect(0, 0, W, H);
    }

    // drifting cloud shadows when partly cloudy
    const cl = L[Wx.Cloudy]! + L[Wx.Clear]! * 0.25;
    if (cl > 0.02 && !still) {
      g.fillStyle = `rgba(60,75,95,${(0.07 * cl).toFixed(3)})`;
      for (let i = 0; i < 4; i++) {
        const cx = ((hash(i + 1) * 1.6 + time * (0.006 + i * 0.002)) % 1.6) * W - 0.3 * W;
        const cy = hash(i + 9) * H;
        g.beginPath();
        g.ellipse(cx, cy, W * (0.18 + hash(i + 4) * 0.12), H * (0.12 + hash(i + 6) * 0.1), 0, 0, Math.PI * 2);
        g.fill();
      }
    }

    // heat: warm wash + sun glow from the top
    if (L[Wx.Heat]! > 0.01) {
      const a = L[Wx.Heat]!;
      g.fillStyle = `rgba(255,196,96,${(0.11 * a).toFixed(3)})`;
      g.fillRect(0, 0, W, H);
      const grad = g.createRadialGradient(W * 0.82, -H * 0.05, 4, W * 0.82, -H * 0.05, Math.max(W, H) * 0.8);
      grad.addColorStop(0, `rgba(255,236,160,${(0.34 * a).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(255,236,160,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      if (!still) {
        // faint haze bands rising
        g.fillStyle = `rgba(255,255,255,${(0.05 * a).toFixed(3)})`;
        for (let i = 0; i < 5; i++) {
          const y = H - ((time * 22 + i * H * 0.23) % H);
          g.fillRect(0, y, W, 3 + Math.sin(time * 2 + i) * 1.5);
        }
      }
    }

    // fog: two slow drifting banks
    if (L[Wx.Fog]! > 0.01) {
      const a = L[Wx.Fog]!;
      g.fillStyle = `rgba(236,242,246,${(0.34 * a).toFixed(3)})`;
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 3; i++) {
        const off = still ? i * 0.3 : (time * (0.012 + i * 0.005) + i * 0.33) % 1;
        const cx = (off * 1.4 - 0.2) * W;
        const grad = g.createRadialGradient(cx, H * (0.3 + i * 0.25), 6, cx, H * (0.3 + i * 0.25), W * 0.5);
        grad.addColorStop(0, `rgba(245,248,250,${(0.5 * a).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(245,248,250,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);
      }
    }

    // rain / storm streaks
    const rain = L[Wx.Rain]! + L[Wx.Storm]! * 1.4;
    if (rain > 0.02) {
      const n = Math.min(MAX_DROPS, Math.floor(MAX_DROPS * Math.min(1, rain)));
      const slant = L[Wx.Storm]! > 0.3 ? 0.42 : 0.2;
      const len = 14 + 10 * L[Wx.Storm]!;
      g.strokeStyle = `rgba(225,238,252,${Math.min(0.8, 0.5 + 0.25 * rain).toFixed(3)})`;
      g.lineWidth = 1.7;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const sp = 620 + hash(i + 3) * 380;
        const t = still ? 0 : time;
        const y = (hash(i) * (H + 60) + t * sp) % (H + 60) - 30;
        const x = (hash(i + 77) * (W + 80) - t * sp * slant * 0.3 + W * 2) % (W + 80) - 20;
        g.moveTo(x, y);
        g.lineTo(x - len * slant, y + len);
      }
      g.stroke();
    }

    // lightning strikes come from the simulation
    if (this.flash > 0.01 && !still) {
      g.fillStyle = `rgba(255,255,255,${(0.38 * this.flash).toFixed(3)})`;
      g.fillRect(0, 0, W, H);
    }

    // snow
    if (L[Wx.Snow]! > 0.02) {
      const a = L[Wx.Snow]!;
      const n = Math.floor(MAX_FLAKES * a);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const sp = 38 + hash(i + 5) * 46;
        const t = still ? 0 : time;
        const y = (hash(i + 11) * (H + 40) + t * sp) % (H + 40) - 20;
        const x = (hash(i + 31) * W + Math.sin(t * 0.9 + i) * 14 + W) % W;
        const r = 1.1 + hash(i + 51) * 1.7;
        g.moveTo(x + r, y);
        g.arc(x, y, r, 0, Math.PI * 2);
      }
      g.fill();
    }
  }
}
