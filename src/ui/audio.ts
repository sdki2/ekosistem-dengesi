/**
 * Procedural ambience (wind, water, birds, crickets) + soft UI clicks.
 * Everything is synthesised with the Web Audio API — no audio files.
 * Off by default; created lazily on the first user gesture.
 */
export class AmbientAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private waterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  enabled = false;
  private river = false;
  private night = false;
  private nextChirp = 0;
  private timer = 0;

  private ensure(): boolean {
    if (this.ctx) return true;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      // brown-ish noise: softer than white noise
      last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
      d[i] = last * 3.5;
    }
    const src = (filter: BiquadFilterNode, gain: GainNode) => {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      s.connect(filter).connect(gain).connect(this.master!);
      s.start();
    };
    // wind
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 500;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.35;
    src(wf, this.windGain);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain).connect(this.windGain.gain);
    lfo.start();
    // water
    const bf = ctx.createBiquadFilter();
    bf.type = 'bandpass';
    bf.frequency.value = 900;
    bf.Q.value = 0.6;
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0;
    src(bf, this.waterGain);
    return true;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on && !this.ensure()) return;
    if (!this.ctx || !this.master) return;
    if (on) void this.ctx.resume();
    this.master.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.4);
    if (on) this.applyScene();
  }

  setScene(river: boolean, night: boolean): void {
    if (river === this.river && night === this.night) return;
    this.river = river;
    this.night = night;
    this.applyScene();
  }

  private applyScene(): void {
    if (!this.ctx || !this.waterGain) return;
    this.waterGain.gain.setTargetAtTime(this.river ? 0.6 : 0, this.ctx.currentTime, 1);
  }

  /** call every frame; schedules birdsong by day and crickets at night */
  update(dt: number): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    this.timer += dt;
    if (this.timer < this.nextChirp) return;
    this.timer = 0;
    if (this.night) {
      this.cricket();
      this.nextChirp = 0.6 + Math.random() * 1.4;
    } else {
      this.bird();
      this.nextChirp = 1.5 + Math.random() * 4;
    }
  }

  private bird(): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const base = 2200 + Math.random() * 1500;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      const t = t0 + k * 0.13;
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.3), t + 0.08);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o.connect(g).connect(this.master!);
      o.start(t);
      o.stop(t + 0.12);
    }
  }

  private cricket(): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 4400;
      const t = t0 + k * 0.06;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.012, t + 0.01);
      g.gain.linearRampToValueAtTime(0, t + 0.04);
      o.connect(g).connect(this.master!);
      o.start(t);
      o.stop(t + 0.05);
    }
  }

  click(kind: 'soft' | 'pop' | 'bad' = 'soft'): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = kind === 'bad' ? 'triangle' : 'sine';
    const f = kind === 'pop' ? 880 : kind === 'bad' ? 220 : 620;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * (kind === 'bad' ? 0.8 : 1.4), t + 0.06);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.1);
  }
}
