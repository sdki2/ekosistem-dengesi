/** Small pooled feedback animations in world coordinates. */

export type FxKind = 'heart' | 'puff' | 'sparkle' | 'dust' | 'catch' | 'place' | 'leaf';

interface Particle {
  kind: FxKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
}

export class Fx {
  private ps: Particle[] = [];
  reducedMotion = false;
  max = 500;

  add(kind: FxKind, x: number, y: number): void {
    if (this.ps.length >= this.max) return;
    if (this.reducedMotion && kind !== 'catch' && kind !== 'place') return;
    const r = Math.random;
    switch (kind) {
      case 'heart':
        this.ps.push({ kind, x, y: y - 0.4, vx: 0, vy: -0.5, age: 0, life: 1.1, size: 0.28 });
        break;
      case 'puff':
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + r();
          this.ps.push({ kind, x, y: y - 0.2, vx: Math.cos(a) * 0.5, vy: Math.sin(a) * 0.35 - 0.2, age: 0, life: 0.9, size: 0.14 + r() * 0.08 });
        }
        break;
      case 'catch':
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          this.ps.push({ kind, x, y: y - 0.2, vx: Math.cos(a) * 0.9, vy: Math.sin(a) * 0.6, age: 0, life: 0.6, size: 0.1 });
        }
        break;
      case 'sparkle':
        this.ps.push({ kind, x: x + (r() - 0.5) * 0.4, y: y - 0.3, vx: 0, vy: -0.3, age: 0, life: 0.7, size: 0.16 });
        break;
      case 'dust':
        for (let k = 0; k < 2; k++) this.ps.push({ kind, x: x + (r() - 0.5) * 0.3, y: y + 0.15, vx: (r() - 0.5) * 0.4, vy: -0.15, age: 0, life: 0.6, size: 0.1 + r() * 0.06 });
        break;
      case 'place':
        this.ps.push({ kind, x, y, vx: 0, vy: 0, age: 0, life: 0.5, size: 0.6 });
        break;
      case 'leaf':
        this.ps.push({ kind, x: x + (r() - 0.5), y: y + (r() - 0.5), vx: (r() - 0.5) * 0.4, vy: -0.4 - r() * 0.3, age: 0, life: 0.8, size: 0.12 });
        break;
    }
  }

  update(dt: number): void {
    const ps = this.ps;
    let j = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]!;
      p.age += dt;
      if (p.age >= p.life) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ps[j++] = p;
    }
    ps.length = j;
  }

  clear(): void {
    this.ps.length = 0;
  }

  draw(g: CanvasRenderingContext2D, toScreen: (x: number, y: number) => [number, number], zoom: number): void {
    for (const p of this.ps) {
      const t = p.age / p.life;
      const [sx, sy] = toScreen(p.x, p.y);
      const s = p.size * zoom;
      g.globalAlpha = 1 - t;
      switch (p.kind) {
        case 'heart': {
          const k = s * (0.8 + Math.sin(t * Math.PI) * 0.4);
          g.fillStyle = '#ef7d95';
          g.beginPath();
          g.moveTo(sx, sy + k * 0.35);
          g.bezierCurveTo(sx - k, sy - k * 0.3, sx - k * 0.4, sy - k, sx, sy - k * 0.45);
          g.bezierCurveTo(sx + k * 0.4, sy - k, sx + k, sy - k * 0.3, sx, sy + k * 0.35);
          g.fill();
          break;
        }
        case 'puff':
          g.fillStyle = 'rgba(235,235,230,0.9)';
          g.beginPath();
          g.arc(sx, sy, s * (1 + t * 1.5), 0, Math.PI * 2);
          g.fill();
          break;
        case 'catch':
          g.fillStyle = '#c9b8a6';
          g.beginPath();
          g.arc(sx, sy, s * (1 - t * 0.5), 0, Math.PI * 2);
          g.fill();
          break;
        case 'sparkle': {
          g.fillStyle = '#fff3a8';
          const k = s * (1 - t * 0.4);
          g.beginPath();
          g.moveTo(sx, sy - k);
          g.lineTo(sx + k * 0.25, sy - k * 0.25);
          g.lineTo(sx + k, sy);
          g.lineTo(sx + k * 0.25, sy + k * 0.25);
          g.lineTo(sx, sy + k);
          g.lineTo(sx - k * 0.25, sy + k * 0.25);
          g.lineTo(sx - k, sy);
          g.lineTo(sx - k * 0.25, sy - k * 0.25);
          g.closePath();
          g.fill();
          break;
        }
        case 'dust':
          g.fillStyle = 'rgba(190,160,120,0.7)';
          g.beginPath();
          g.arc(sx, sy, s * (1 + t), 0, Math.PI * 2);
          g.fill();
          break;
        case 'place':
          g.strokeStyle = 'rgba(255,255,255,0.9)';
          g.lineWidth = 2;
          g.beginPath();
          g.arc(sx, sy, s * (0.3 + t), 0, Math.PI * 2);
          g.stroke();
          break;
        case 'leaf':
          g.fillStyle = '#7cc46a';
          g.beginPath();
          g.ellipse(sx, sy, s, s * 0.5, t * 4, 0, Math.PI * 2);
          g.fill();
          break;
      }
    }
    g.globalAlpha = 1;
  }
}
