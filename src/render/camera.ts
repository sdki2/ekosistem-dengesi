/** 2D camera: (cx, cy) world centre in tiles, zoom in CSS px per tile. */
export class Camera {
  cx = 32;
  cy = 20;
  zoom = 20;
  minZoom = 6;
  maxZoom = 80;
  /** viewport size in CSS px */
  vw = 800;
  vh = 600;
  worldW = 64;
  worldH = 40;
  /** true once the player pans/zooms; until then the map refits on resize */
  userMoved = false;
  /** uid of the followed animal, or 0 */
  follow = 0;

  setWorld(w: number, h: number): void {
    this.worldW = w;
    this.worldH = h;
  }

  resize(vw: number, vh: number): void {
    this.vw = vw;
    this.vh = vh;
    this.minZoom = Math.min(this.fitZoom() * 0.8, 12);
    if (!this.userMoved) this.fit();
  }

  fitZoom(): number {
    return Math.min(this.vw / this.worldW, this.vh / this.worldH);
  }

  fit(): void {
    this.userMoved = false;
    this.zoom = Math.max(1, this.fitZoom());
    this.cx = this.worldW / 2;
    this.cy = this.worldH / 2;
  }

  toScreen(x: number, y: number): [number, number] {
    return [(x - this.cx) * this.zoom + this.vw / 2, (y - this.cy) * this.zoom + this.vh / 2];
  }

  toWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.vw / 2) / this.zoom + this.cx, (sy - this.vh / 2) / this.zoom + this.cy];
  }

  pan(dxPx: number, dyPx: number): void {
    this.userMoved = true;
    this.cx -= dxPx / this.zoom;
    this.cy -= dyPx / this.zoom;
    this.clamp();
  }

  /** zoom by factor keeping the world point under (sx, sy) fixed */
  zoomAt(factor: number, sx: number, sy: number): void {
    this.userMoved = true;
    const [wx, wy] = this.toWorld(sx, sy);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const [nx, ny] = this.toWorld(sx, sy);
    this.cx += wx - nx;
    this.cy += wy - ny;
    this.clamp();
  }

  clamp(): void {
    const halfW = this.vw / 2 / this.zoom;
    const halfH = this.vh / 2 / this.zoom;
    const mx = Math.max(0, halfW - this.worldW / 2 + 2);
    const my = Math.max(0, halfH - this.worldH / 2 + 2);
    this.cx = Math.max(halfW - 2 - mx, Math.min(this.worldW - halfW + 2 + mx, this.cx));
    this.cy = Math.max(halfH - 2 - my, Math.min(this.worldH - halfH + 2 + my, this.cy));
    if (this.worldW * this.zoom <= this.vw) this.cx = this.worldW / 2;
    if (this.worldH * this.zoom <= this.vh) this.cy = this.worldH / 2;
  }

  /** visible world rect [x0, y0, x1, y1] */
  view(): [number, number, number, number] {
    const [x0, y0] = this.toWorld(0, 0);
    const [x1, y1] = this.toWorld(this.vw, this.vh);
    return [x0, y0, x1, y1];
  }
}
