import { ECONOMY } from '../config';
import { STR, fmt, num } from '../content/i18n';
import { LEVELS, type LevelDef } from '../content/levels';
import { countPeaksDaily } from '../game/peaks';
import { Session, type SessionOptions, type Tool } from '../game/session';
import { load, resetProgress, save, type SaveData } from '../game/storage';
import { AState, Species } from '../sim/agents';
import { randomSeed } from '../sim/rng';
import type { EventKind, SimEvent } from '../sim/world';
import { WorldRenderer } from '../render/renderer';
import { AmbientAudio } from './audio';
import { FloatingTip, Modal, h, installTooltips } from './dom';
import {
  collapseScreen, encyclopedia, goalFailedScreen, goalText, helpScreen, levelIntro, levelSelect, mainMenu,
  sandboxSetup, settingsScreen, summaryScreen,
} from './screens';
import { StatsPanel } from './statsPanel';
import { runTutorial } from './tutorial';

const SPEEDS = [1, 2, 4, 8];
/** real seconds per tick at 1× (10 s per day / 20 ticks) */
const TICK_SECONDS = 10 / 20;
const TOOLS: { id: Tool; emoji: string; key: string }[] = [
  { id: 'plant', emoji: '🌱', key: '1' },
  { id: 'rabbit', emoji: '🐇', key: '2' },
  { id: 'wolf', emoji: '🐺', key: '3' },
  { id: 'inspect', emoji: '🔍', key: '4' },
  { id: 'remove', emoji: '✋', key: '5' },
];

export class App {
  save: SaveData = load();
  session!: Session;
  sessionOpts!: SessionOptions;
  renderer: WorldRenderer;
  stats = new StatsPanel();
  modal = new Modal();
  audio = new AmbientAudio();
  floatTip = new FloatingTip();

  tool: Tool = 'inspect';
  brush = 2;
  speedIdx = 0;
  playing = false;
  private acc = 0;
  selectedUid = 0;
  selectedTile: [number, number] | null = null;
  hoverWorld: [number, number] | null = null;
  hoverUid = 0;
  reduced = false;
  showPerf = false;
  private tickMs = 0;
  private fps = 60;
  private lastFrame = 0;
  private uiTimer = 0;
  private perfLogTimer = 0;
  private demo = true;
  private lastNight = false;
  private endShown = false;

  // dom
  private root: HTMLElement;
  private worldWrap!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private dayChip!: HTMLElement;
  private budgetChip!: HTMLElement;
  private goalChip!: HTMLElement;
  private playBtn!: HTMLButtonElement;
  private speedBtn!: HTMLButtonElement;
  private soundBtn!: HTMLButtonElement;
  private settingsBtn!: HTMLButtonElement;
  private newMapBtn!: HTMLButtonElement;
  private toolBtns = new Map<Tool, HTMLButtonElement>();
  private brushInput!: HTMLInputElement;
  private brushLabel!: HTMLElement;
  private inspector!: HTMLElement;
  private bannerArea!: HTMLElement;
  private perfEl!: HTMLElement;
  private toastEl: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.buildDom();
    this.renderer = new WorldRenderer(this.canvas);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyMotion = () => {
      this.reduced = mq.matches;
      this.renderer.reducedMotion = this.reduced;
      this.renderer.fx.reducedMotion = this.reduced;
      this.stats.reducedMotion = this.reduced;
    };
    applyMotion();
    mq.addEventListener?.('change', applyMotion);
    this.showPerf = /[?&]perf\b/.test(location.search);
    installTooltips();
    this.bindInput();
    new ResizeObserver(() => this.renderer.resize()).observe(this.worldWrap);
    this.renderer.resize();

    if (/[?&]stress\b/.test(location.search)) {
      this.startSandbox({ map: 'forest', seed: 77, seasons: false, randomEvents: false });
      this.stress();
    } else {
      // live demo world behind the main menu
      this.newSession({ mode: 'sandbox', map: 'forest', seed: 1201 });
      this.demo = true;
      this.playing = true;
      this.showMainMenu();
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  // ───────────────────────── DOM ─────────────────────────

  private buildDom(): void {
    const C = STR.controls;
    this.dayChip = h('span', { class: 'chip', tip: STR.hud.dayTime });
    this.budgetChip = h('span', { class: 'chip budget', tip: STR.hud.budgetTip });
    this.goalChip = h('span', { class: 'chip goal hide-sm' });
    this.playBtn = h('button', { class: 'icon-btn primary', 'aria-label': C.play, tip: C.play, onclick: () => this.togglePlay() }, '▶');
    this.speedBtn = h('button', { class: 'icon-btn', tip: C.speed, 'aria-label': C.speed, onclick: () => this.cycleSpeed() }, '1×');
    this.soundBtn = h('button', { class: 'icon-btn', tip: C.sound, 'aria-label': C.sound, onclick: () => this.toggleSound() }, '🔇');
    this.settingsBtn = h('button', { class: 'icon-btn', tip: C.settings, 'aria-label': C.settings, onclick: () => this.openSettings() }, '⚙️');
    this.newMapBtn = h('button', { class: 'icon-btn', tip: C.newMap, 'aria-label': C.newMap, onclick: () => this.newMap() }, '🎲');
    const topbar = h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'brand' }, h('span', { class: 'logo' }, '🌿'), h('span', { class: 'title' }, STR.app.title)),
      this.dayChip,
      this.budgetChip,
      this.goalChip,
      h('span', { class: 'spacer' }),
      h(
        'div',
        { class: 'btn-group time-controls' },
        this.playBtn,
        h('button', { class: 'icon-btn', tip: C.step, 'aria-label': C.step, onclick: () => this.stepOnce() }, '⏭'),
        this.speedBtn,
      ),
      h(
        'div',
        { class: 'btn-group' },
        h('button', { class: 'icon-btn', tip: C.reset, 'aria-label': C.reset, onclick: () => this.restart() }, '↺'),
        this.newMapBtn,
        this.settingsBtn,
        h('button', { id: 'btn-ency', class: 'icon-btn', tip: STR.menu.encyclopedia, 'aria-label': STR.menu.encyclopedia, onclick: () => this.openEncyclopedia() }, '📖'),
        this.soundBtn,
        h('button', { class: 'icon-btn', tip: C.help, 'aria-label': C.help, onclick: () => this.modal.open(helpScreen()) }, '⌨️'),
        h('button', { class: 'icon-btn', tip: STR.hud.menu, 'aria-label': STR.hud.menu, onclick: () => this.showMainMenu() }, '☰'),
      ),
    );

    // toolbar
    const toolbar = h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Araçlar' });
    for (const t of TOOLS) {
      const label = STR.tools[t.id];
      const cost = t.id === 'rabbit' ? ECONOMY.rabbitCost : t.id === 'wolf' ? ECONOMY.wolfCost : t.id === 'plant' ? ECONOMY.plantTileCost : 0;
      const tipKey = `${t.id}Tip` as 'plantTip';
      const btn = h(
        'button',
        { class: 'tool', 'aria-label': `${label} (${t.key})`, 'aria-pressed': 'false', tip: `<b>${label}</b> (${t.key})<br>${fmt(STR.tools[tipKey], { cost })}`, onclick: () => this.setTool(t.id) },
        h('span', { class: 'key' }, t.key),
        h('span', { class: 'emoji', 'aria-hidden': 'true' }, t.emoji),
        label.split(' ')[0]!,
        cost ? h('span', { class: 'cost' }, `💰${cost}`) : null,
      );
      this.toolBtns.set(t.id, btn);
      toolbar.append(btn);
    }
    this.brushInput = h('input', { type: 'range', min: '0.5', max: '6', step: '0.5', value: String(this.brush), 'aria-label': 'Fırça' });
    this.brushInput.addEventListener('input', () => this.setBrush(Number(this.brushInput.value)));
    this.brushLabel = h('span', {}, fmt(STR.tools.brush, { n: this.brush }));
    toolbar.append(h('div', { class: 'brush-ctl', tip: '[ ]' }, this.brushLabel, this.brushInput));

    this.inspector = h('div', { class: 'card inspector hidden', 'aria-live': 'polite' });
    this.bannerArea = h('div', { class: 'banner-area' });
    this.perfEl = h('div', { class: 'perf' });
    this.canvas = h('canvas', { id: 'world', 'aria-label': 'Ekosistem haritası', role: 'img' });
    const zoom = h(
      'div',
      { class: 'zoom-ctl' },
      h('button', { class: 'icon-btn', tip: C.zoomIn, 'aria-label': C.zoomIn, onclick: () => this.zoomBy(1.25) }, '+'),
      h('button', { class: 'icon-btn', tip: C.zoomOut, 'aria-label': C.zoomOut, onclick: () => this.zoomBy(0.8) }, '−'),
      h('button', { class: 'icon-btn', tip: C.fit, 'aria-label': C.fit, onclick: () => this.renderer.cam.fit() }, '⤢'),
    );
    this.worldWrap = h('section', { class: 'world-wrap tool-inspect' }, this.canvas, this.inspector, this.bannerArea, toolbar, zoom, this.perfEl);
    this.stats.onExport = () => this.exportCsv();
    this.stats.onPyramidBad = () => this.tip('pyramid', 'pyramid');
    this.root.append(topbar, h('main', { class: 'layout' }, this.worldWrap, this.stats.el));
    this.setTool('inspect');
  }

  // ───────────────────────── sessions ─────────────────────────

  private newSession(opts: SessionOptions): void {
    this.sessionOpts = opts;
    this.session = new Session(opts);
    this.renderer.setWorld(this.session.world);
    this.acc = 0;
    this.selectedUid = 0;
    this.selectedTile = null;
    this.renderer.cam.follow = 0;
    this.bannerArea.innerHTML = '';
    const sandbox = opts.mode === 'sandbox';
    this.stats.showPhase(sandbox);
    this.settingsBtn.disabled = !sandbox;
    this.newMapBtn.disabled = !sandbox;
    this.audio.setScene(this.session.world.mapKind === 'river', false);
    this.updateHud();
    this.stats.updateNumbers(this.session);
  }

  startLevel(L: LevelDef): void {
    this.demo = false;
    this.modal.close();
    this.newSession({ mode: 'scenario', level: L });
    this.setPlaying(true);
    this.maybeTutorial();
  }

  startSandbox(o: { map: 'forest' | 'river'; seed: number; seasons: boolean; randomEvents: boolean }): void {
    this.demo = false;
    this.modal.close();
    this.newSession({ mode: 'sandbox', ...o });
    this.setPlaying(true);
    this.maybeTutorial();
  }

  private maybeTutorial(): void {
    if (this.save.tutorialDone) return;
    this.setPlaying(false);
    runTutorial(() => {
      this.save.tutorialDone = true;
      save(this.save);
      this.setPlaying(true);
    });
  }

  restart(): void {
    if (this.demo) return;
    this.newSession(this.sessionOpts);
    this.setPlaying(true);
  }

  newMap(): void {
    if (this.session.mode !== 'sandbox' || this.demo) return;
    this.newSession({ ...this.sessionOpts, seed: randomSeed() % 100000, cfg: this.session.world.cfg });
    this.setPlaying(true);
  }

  private stress(): void {
    const w = this.session.world;
    w.cfg.maxAnimals = 1500;
    for (let k = 0; k < 1300; k++) {
      const [x, y] = w.randomWalkable();
      w.spawnAnimal(Species.Rabbit, x, y, true);
    }
    for (let k = 0; k < 190; k++) {
      const [x, y] = w.randomWalkable();
      w.spawnAnimal(Species.Wolf, x, y, true);
    }
    this.showPerf = true;
  }

  // ───────────────────────── menus ─────────────────────────

  showMainMenu(): void {
    const wasPlaying = this.playing;
    if (!this.demo) this.setPlaying(false);
    const total = Object.values(this.save.stars).reduce((a, b) => a + b, 0);
    this.modal.open(
      mainMenu({
        totalStars: total,
        scenario: () => this.showLevels(),
        sandbox: () => this.modal.open(sandboxSetup({ start: (o) => this.startSandbox(o), back: () => this.showMainMenu() }), { dismissable: !this.demo }),
        encyclopedia: () => this.openEncyclopedia(undefined, () => this.showMainMenu()),
        tutorial: () => {
          this.modal.close();
          runTutorial(() => this.showMainMenu());
        },
      }),
      { dismissable: !this.demo, onClose: () => !this.demo && wasPlaying && this.setPlaying(true) },
    );
  }

  showLevels(): void {
    this.modal.open(
      levelSelect(this.save, {
        play: (L) => this.modal.open(levelIntro(L, { start: () => this.startLevel(L), back: () => this.showLevels() }), { dismissable: !this.demo }),
        back: () => this.showMainMenu(),
        reset: () => {
          resetProgress(this.save);
          this.showLevels();
        },
      }),
      { wide: true, dismissable: !this.demo },
    );
  }

  openEncyclopedia(id?: string, after?: () => void): void {
    const was = this.playing;
    if (!this.demo) this.setPlaying(false);
    this.modal.open(encyclopedia(id), { wide: true, onClose: () => (after ? after() : !this.demo && was && this.setPlaying(true)) });
  }

  openSettings(): void {
    if (this.session.mode !== 'sandbox' || this.demo) return;
    this.modal.open(settingsScreen(this.session, { trigger: (k: EventKind) => { this.session.world.startEvent(k); this.modal.close(); } }), { wide: true });
  }

  // ───────────────────────── time ─────────────────────────

  setPlaying(p: boolean): void {
    this.playing = p;
    this.playBtn.textContent = p ? '⏸' : '▶';
    this.playBtn.dataset.tip = p ? STR.controls.pause : STR.controls.play;
    this.playBtn.setAttribute('aria-label', p ? STR.controls.pause : STR.controls.play);
  }

  togglePlay(): void {
    if (this.session.status !== 'playing') return;
    this.setPlaying(!this.playing);
    this.audio.click();
  }

  cycleSpeed(): void {
    this.speedIdx = (this.speedIdx + 1) % SPEEDS.length;
    this.speedBtn.textContent = `${SPEEDS[this.speedIdx]}×`;
    this.audio.click();
  }

  get speed(): number {
    return SPEEDS[this.speedIdx]!;
  }

  stepOnce(): void {
    if (this.session.status !== 'playing') return;
    this.setPlaying(false);
    this.doStep();
    this.acc = TICK_SECONDS;
  }

  private doStep(): void {
    const t0 = performance.now();
    const events = this.session.step();
    const dt = performance.now() - t0;
    this.tickMs = this.tickMs * 0.95 + dt * 0.05;
    this.handleEvents(events);
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, this.lastFrame ? (now - this.lastFrame) / 1000 : 0.016);
    this.lastFrame = now;
    if (dt > 0) this.fps = this.fps * 0.95 + (1 / dt) * 0.05;

    if (this.playing && this.session.status === 'playing') {
      this.acc += dt * this.speed;
      let steps = 0;
      while (this.acc >= TICK_SECONDS && steps < 40) {
        this.doStep();
        this.acc -= TICK_SECONDS;
        steps++;
        if (this.session.status !== 'playing') break;
      }
      if (steps >= 40) this.acc = 0;
    }
    // end of run (from the play loop or a single step): show the result once
    if (this.session.status !== 'playing') {
      if (!this.endShown) {
        this.endShown = true;
        this.onEnded();
      }
    } else this.endShown = false;
    const alpha = this.playing ? Math.min(1, this.acc / TICK_SECONDS) : 1;

    // camera follow
    const cam = this.renderer.cam;
    if (cam.follow) {
      const a = this.session.world.agents;
      const i = a.findByUid(cam.follow);
      if (i < 0) cam.follow = 0;
      else {
        const tx = a.px[i]! + (a.x[i]! - a.px[i]!) * alpha;
        const ty = a.py[i]! + (a.y[i]! - a.py[i]!) * alpha;
        cam.cx += (tx - cam.cx) * 0.2;
        cam.cy += (ty - cam.cy) * 0.2;
      }
    }

    this.renderer.render(alpha, dt, this.playing ? this.speed : 0, {
      hover: this.hoverWorld,
      tool: this.tool,
      brush: this.brush,
      selectedUid: this.selectedUid,
      hoverUid: this.hoverUid,
    });

    const night = this.session.world.night;
    if (night !== this.lastNight) {
      this.lastNight = night;
      this.audio.setScene(this.session.world.mapKind === 'river', night);
    }
    this.audio.update(dt);

    this.uiTimer += dt;
    if (this.uiTimer > 0.25) {
      this.uiTimer = 0;
      this.updateHud();
      this.stats.updateNumbers(this.session);
      this.updateInspector();
    }
    this.stats.updateCharts(this.session, this.session.mode === 'sandbox');

    if (this.showPerf) {
      this.perfEl.style.display = '';
      this.perfEl.textContent = fmt(STR.stats.perf, { fps: this.fps.toFixed(0), ms: this.tickMs.toFixed(2), n: this.session.world.totalAnimals() });
      this.perfLogTimer += dt;
      if (this.perfLogTimer > 10) {
        this.perfLogTimer = 0;
        console.info(`[perf] ${this.fps.toFixed(1)} FPS, ortalama tick ${this.tickMs.toFixed(3)} ms, ${this.session.world.totalAnimals()} hayvan, hız ${this.speed}×`);
      }
    } else this.perfEl.style.display = 'none';

    requestAnimationFrame((t) => this.frame(t));
  }

  // ───────────────────────── sim events → feedback ─────────────────────────

  private handleEvents(events: SimEvent[]): void {
    const fx = this.renderer.fx;
    const p = 1 / Math.sqrt(this.speed);
    for (const e of events) {
      switch (e.type) {
        case 'birth':
          if (Math.random() < p) fx.add('heart', e.x, e.y);
          break;
        case 'death':
          if (e.cause !== 'eaten' && Math.random() < p) fx.add('puff', e.x, e.y);
          break;
        case 'catch':
          fx.add('catch', e.x, e.y);
          break;
        case 'eat':
          if (Math.random() < p) fx.add('sparkle', e.x, e.y);
          break;
        case 'flee':
          if (Math.random() < p) fx.add('dust', e.x, e.y);
          break;
        case 'eventStart':
          this.eventBanner(e.kind, e.species, e.killed);
          break;
        case 'eventEnd':
          this.banner(fmt(STR.events.ended, { name: STR.events.names[e.kind] }), '', 'good', 4000);
          break;
        case 'newDay':
          if (!this.demo) this.dailyTips();
          break;
        default:
          break;
      }
    }
  }

  private eventBanner(kind: EventKind, species?: Species, killed?: number): void {
    const E = STR.events;
    const ev = this.session.world.cfg.events;
    if (kind === 'drought') {
      this.banner(E.drought.title, fmt(E.drought.text, { days: ev.droughtDays }), 'warn', 9000);
      this.tip('drought', 'capacity');
    } else if (kind === 'winter') this.banner(E.winter.title, fmt(E.winter.text, { days: ev.winterDays }), 'warn', 9000);
    else this.banner(E.disease.title, fmt(E.disease.text, { species: species === Species.Wolf ? STR.species.wolves : STR.species.rabbits, n: killed ?? 0 }), 'bad', 9000);
    this.audio.click('bad');
  }

  private dailyTips(): void {
    const w = this.session.world;
    if (w.plantCover() < 20 && w.day > 3) this.tip('overgrazing', 'overgrazing');
    if (w.day > 60 && w.day % 10 === 0 && countPeaksDaily(w.history.days.map((d) => d.rabbits)) >= 2) this.tip('cycle', 'cycle');
  }

  /** contextual tip shown once per save */
  tip(id: 'pyramid' | 'overgrazing' | 'firstWolf' | 'cycle' | 'drought', card: string): void {
    if (this.demo || this.save.tipsSeen.includes(id)) return;
    this.save.tipsSeen.push(id);
    save(this.save);
    const b = this.banner('💡 ' + STR.app.title, STR.tips[id], 'info', 14000, [
      { label: '📖 ' + STR.tips.readMore, run: () => this.openEncyclopedia(card) },
      { label: STR.tips.dismiss, run: () => {} },
    ]);
    b.setAttribute('role', 'status');
  }

  banner(title: string, text: string, kind: 'warn' | 'info' | 'good' | 'bad', ms: number, actions: { label: string; run: () => void }[] = []): HTMLElement {
    const b = h('div', { class: `banner ${kind === 'warn' ? '' : kind}`, role: 'alert' }, h('b', {}, title), text);
    const remove = () => {
      if (!b.isConnected) return;
      b.classList.add('leaving');
      setTimeout(() => b.remove(), 300);
    };
    if (actions.length) {
      b.append(h('div', { class: 'banner-actions' }, ...actions.map((a) => h('button', { class: 'icon-btn', onclick: () => { remove(); a.run(); } }, a.label))));
    }
    this.bannerArea.append(b);
    while (this.bannerArea.children.length > 3) this.bannerArea.firstElementChild!.remove();
    setTimeout(remove, ms);
    return b;
  }

  private toast(msg: string): void {
    this.toastEl?.remove();
    this.toastEl = h('div', { class: 'toast', role: 'status' }, msg);
    this.worldWrap.append(this.toastEl);
    const el = this.toastEl;
    setTimeout(() => el.remove(), 1800);
  }

  // ───────────────────────── end of run ─────────────────────────

  private onEnded(): void {
    this.setPlaying(false);
    const s = this.session;
    if (this.demo) {
      // the menu demo just restarts quietly
      this.newSession({ mode: 'sandbox', map: 'forest', seed: randomSeed() % 10000 });
      this.setPlaying(true);
      return;
    }
    const retry = () => {
      this.modal.close();
      this.restart();
    };
    const rewind = () => {
      if (s.rewind(10)) {
        this.renderer.fx.clear();
        this.modal.close();
        this.setPlaying(false);
      }
    };
    const menu = () => (s.mode === 'scenario' ? this.showLevels() : this.showMainMenu());
    if (s.status === 'won' && s.level) {
      const stars = s.stars();
      const id = s.level.id;
      this.save.stars[id] = Math.max(this.save.stars[id] ?? 0, stars);
      save(this.save);
      const idx = LEVELS.findIndex((l) => l.id === id);
      const next = LEVELS[idx + 1];
      this.audio.click('pop');
      this.modal.open(summaryScreen(s, stars, id * 3 + Math.floor(Math.random() * 3), { hasNext: !!next, next: () => next && this.modal.open(levelIntro(next, { start: () => this.startLevel(next), back: () => this.showLevels() })), retry, menu }), { dismissable: false });
      return;
    }
    if (s.endReason?.kind === 'extinct') {
      const reason = s.endReason;
      this.modal.open(collapseScreen(s, reason.species, reason.day, { retry, rewind, menu, cont: () => { s.continueAnyway(); this.modal.close(); this.setPlaying(true); } }), { dismissable: false });
    } else if (s.endReason?.kind === 'goal') {
      this.modal.open(goalFailedScreen(s, { retry, rewind, menu }), { dismissable: false });
    }
  }

  // ───────────────────────── HUD ─────────────────────────

  private updateHud(): void {
    const w = this.session.world;
    const H = STR.hud;
    const s = w.season();
    const night = w.night;
    const seasonTxt = s >= 0 ? `${H.seasonIcons[s]} ${H.seasonNames[s]}` : '';
    this.dayChip.innerHTML = '';
    const bar = h('span', { class: 'daybar', 'aria-hidden': 'true' }, h('i', { style: `width:${(w.dayFrac * 100).toFixed(0)}%` }));
    this.dayChip.append(night ? '🌙' : '☀️', ` ${fmt(H.day, { n: w.day + 1 })}`, bar, seasonTxt ? ` ${seasonTxt}` : '');
    this.dayChip.dataset.tip = `${night ? H.night : H.dayTime}${seasonTxt ? ' · ' + seasonTxt : ' · ' + H.noSeasons}`;
    this.budgetChip.textContent = `💰 ${this.session.unlimited ? H.unlimited : num(Math.floor(this.session.budget))}`;
    const L = this.session.level;
    if (L && !this.demo) {
      this.goalChip.style.display = '';
      this.goalChip.textContent = `🎯 ${fmt(STR.levels.progress, { day: Math.min(w.day, L.goal.days), days: L.goal.days })}`;
      this.goalChip.dataset.tip = goalText(L);
    } else this.goalChip.style.display = 'none';
  }

  private updateInspector(): void {
    const el = this.inspector;
    const w = this.session.world;
    const I = STR.inspector;
    if (!this.selectedUid && !this.selectedTile) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    el.innerHTML = '';
    const row = (k: string, v: string | Node) => h('div', { class: 'row' }, h('span', {}, k), h('span', {}, v));
    const add = (...xs: (Node | string | null)[]) => el.append(...(xs.filter((x) => x !== null) as (Node | string)[]));
    if (this.selectedUid) {
      const a = w.agents;
      const i = a.findByUid(this.selectedUid);
      if (i < 0) {
        el.append(h('h3', {}, '🔍 ', I.title), h('p', {}, I.gone));
        this.renderer.cam.follow = 0;
        return;
      }
      const sp = a.species[i] as Species;
      const sc = sp === Species.Rabbit ? w.cfg.rabbit : w.cfg.wolf;
      const e = a.energy[i]! / sc.maxEnergy;
      const status = e > 0.5 ? ['healthy', I.healthy, '💚'] : e > 0.25 ? ['hungry', I.hungry, '🟡'] : ['starving', I.starving, '🔴'];
      const following = this.renderer.cam.follow === this.selectedUid;
      add(
        h('h3', {}, sp === Species.Rabbit ? '🐇' : '🐺', ' ', sp === Species.Rabbit ? STR.species.rabbit : STR.species.wolf, h('span', { style: 'color:var(--ink-soft);font-size:12px;margin-left:auto' }, `${I.id} ${a.uid[i]}`)),
        h('span', { class: `status-badge status-${status[0]}` }, status[2]!, ' ', status[1]!),
        row(I.energy, `${Math.round(a.energy[i]!)} / ${sc.maxEnergy}`),
        h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': String(Math.round(e * 100)), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { style: `width:${Math.max(0, e * 100)}%;background:var(--${status[0]})` })),
        row(I.age, fmt(I.ageDays, { n: (a.age[i]! / w.cfg.ticksPerDay).toFixed(1).replace('.', ',') })),
        row(I.state, STR.states[a.state[i]!] ?? '?'),
        w.grid.hasWater ? row(I.thirst, `%${Math.round(a.thirst[i]!)}`) : null,
        h('div', { class: 'actions' }, h('button', { class: 'icon-btn', onclick: () => { this.renderer.cam.follow = following ? 0 : this.selectedUid; this.updateInspector(); } }, following ? '📍 ' + STR.controls.unfollow : '🎥 ' + STR.controls.follow.replace(' (F)', ''))),
      );
    } else if (this.selectedTile) {
      const [tx, ty] = this.selectedTile;
      const g = w.grid;
      const ti = g.idx(tx, ty);
      add(
        h('h3', {}, '🟩 ', I.tile, ` (${tx}, ${ty})`),
        row('', STR.tiles[g.tiles[ti]!] ?? ''),
        g.growMul[ti]! > 0 ? row(I.plantAmount, `%${g.plant[ti]!.toFixed(0)}`) : null,
        g.growMul[ti]! > 0 ? h('div', { class: 'bar' }, h('i', { style: `width:${g.plant[ti]}%;background:var(--plant)` })) : null,
        g.growMul[ti]! > 0 ? row(I.regrowth, `×${(g.growMul[ti]! * w.regrowMultiplier()).toFixed(2).replace('.', ',')}`) : null,
        g.hasWater && g.waterDist[ti]! < 255 ? row(I.waterDist, fmt(I.tilesAway, { n: g.waterDist[ti]! })) : null,
      );
    }
  }

  // ───────────────────────── tools & input ─────────────────────────

  setTool(t: Tool): void {
    this.tool = t;
    for (const [id, b] of this.toolBtns) {
      b.classList.toggle('active', id === t);
      b.setAttribute('aria-pressed', String(id === t));
    }
    this.worldWrap.className = `world-wrap tool-${t}`;
  }

  setBrush(b: number): void {
    this.brush = Math.max(0.5, Math.min(6, b));
    this.brushInput.value = String(this.brush);
    this.brushLabel.textContent = fmt(STR.tools.brush, { n: String(this.brush).replace('.', ',') });
  }

  zoomBy(f: number): void {
    const cam = this.renderer.cam;
    cam.zoomAt(f, cam.vw / 2, cam.vh / 2);
  }

  toggleSound(): void {
    this.save.sound = !this.save.sound;
    save(this.save);
    this.audio.setEnabled(this.save.sound);
    this.soundBtn.textContent = this.save.sound ? '🔊' : '🔇';
    this.audio.click();
  }

  private applyToolAt(wx: number, wy: number, drag: boolean): void {
    if (this.demo) return;
    const s = this.session;
    if (s.status !== 'playing') return;
    const r = s.apply(this.tool, wx, wy, this.brush);
    if (r.ok) {
      if (this.tool === 'rabbit' || this.tool === 'wolf') {
        this.renderer.fx.add('place', wx, wy);
        this.audio.click('pop');
        if (this.tool === 'wolf') this.tip('firstWolf', 'keystone');
      } else if (this.tool === 'plant' && !drag) {
        for (let k = 0; k < 4; k++) this.renderer.fx.add('leaf', wx, wy);
        this.audio.click();
      } else if (this.tool === 'remove') {
        this.renderer.fx.add('puff', wx, wy);
      }
    } else if (!drag || r.reason === 'budget') {
      if (r.reason === 'budget') this.toast(STR.tools.notEnough);
      else if (r.reason === 'blocked' && this.tool !== 'remove') this.toast(STR.tools.blocked);
      else if (r.reason === 'cap') this.toast(fmt(STR.tools.capReached, { n: s.world.cfg.maxAnimals }));
      if (r.reason) this.audio.click('bad');
    }
  }

  private inspectAt(wx: number, wy: number): void {
    const w = this.session.world;
    const r = Math.max(0.7, 14 / this.renderer.cam.zoom);
    const i = w.animalAt(wx, wy, r);
    if (i >= 0) {
      this.selectedUid = w.agents.uid[i]!;
      this.selectedTile = null;
    } else if (w.grid.inBounds(Math.floor(wx), Math.floor(wy))) {
      this.selectedUid = 0;
      this.renderer.cam.follow = 0;
      this.selectedTile = [Math.floor(wx), Math.floor(wy)];
    } else {
      this.selectedUid = 0;
      this.selectedTile = null;
    }
    this.updateInspector();
  }

  private updateHover(sx: number, sy: number, cx: number, cy: number): void {
    const cam = this.renderer.cam;
    const [wx, wy] = cam.toWorld(sx, sy);
    this.hoverWorld = [wx, wy];
    const w = this.session.world;
    const i = w.animalAt(wx, wy, Math.max(0.6, 12 / cam.zoom));
    this.hoverUid = i >= 0 ? w.agents.uid[i]! : 0;
    if (this.demo) return this.floatTip.hide();
    if (i >= 0) {
      const a = w.agents;
      const sp = a.species[i] as Species;
      const sc = sp === Species.Rabbit ? w.cfg.rabbit : w.cfg.wolf;
      const e = Math.round((a.energy[i]! / sc.maxEnergy) * 100);
      this.floatTip.show(`<b>${sp === Species.Rabbit ? '🐇 ' + STR.species.rabbit : '🐺 ' + STR.species.wolf}</b> · ${STR.states[a.state[i] as AState]}<br>${STR.inspector.energy}: %${e}`, cx, cy);
    } else if (w.grid.inBounds(Math.floor(wx), Math.floor(wy))) {
      const ti = w.grid.idx(Math.floor(wx), Math.floor(wy));
      const t = w.grid.tiles[ti]!;
      this.floatTip.show(`<b>${STR.tiles[t]}</b>${w.grid.growMul[ti]! > 0 ? `<br>🌱 %${w.grid.plant[ti]!.toFixed(0)}` : ''}`, cx, cy);
    } else this.floatTip.hide();
  }

  private bindInput(): void {
    const c = this.canvas;
    const pointers = new Map<number, { x: number; y: number }>();
    let mode: 'none' | 'tool' | 'pan' | 'pinch' = 'none';
    let downX = 0;
    let downY = 0;
    let moved = 0;
    let lastPaint: [number, number] | null = null;
    let pinchDist = 0;
    let pinchMid: [number, number] = [0, 0];
    const local = (e: PointerEvent | WheelEvent): [number, number] => {
      const r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };

    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      const [x, y] = local(e);
      pointers.set(e.pointerId, { x, y });
      this.floatTip.hide();
      if (pointers.size === 2) {
        const [p1, p2] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
        mode = 'pinch';
        pinchDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        pinchMid = [(p1.x + p2.x) / 2, (p1.y + p2.y) / 2];
        return;
      }
      downX = x;
      downY = y;
      moved = 0;
      if (e.button === 1 || e.button === 2 || this.tool === 'inspect' || this.demo) {
        mode = 'pan';
        this.worldWrap.classList.add('panning');
      } else {
        mode = 'tool';
        const [wx, wy] = this.renderer.cam.toWorld(x, y);
        lastPaint = [wx, wy];
        this.applyToolAt(wx, wy, false);
      }
    });
    c.addEventListener('pointermove', (e) => {
      const [x, y] = local(e);
      const prev = pointers.get(e.pointerId);
      if (prev) pointers.set(e.pointerId, { x, y });
      if (mode === 'pinch' && pointers.size >= 2) {
        const [p1, p2] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const mid: [number, number] = [(p1.x + p2.x) / 2, (p1.y + p2.y) / 2];
        const cam = this.renderer.cam;
        cam.pan(mid[0] - pinchMid[0], mid[1] - pinchMid[1]);
        if (pinchDist > 0) cam.zoomAt(d / pinchDist, mid[0], mid[1]);
        pinchDist = d;
        pinchMid = mid;
        return;
      }
      if (mode === 'pan' && prev) {
        moved += Math.abs(x - prev.x) + Math.abs(y - prev.y);
        this.renderer.cam.pan(x - prev.x, y - prev.y);
        if (moved > 4) this.renderer.cam.follow = 0;
        this.hoverWorld = this.renderer.cam.toWorld(x, y);
        return;
      }
      if (mode === 'tool' && prev) {
        const [wx, wy] = this.renderer.cam.toWorld(x, y);
        this.hoverWorld = [wx, wy];
        const spacing = this.tool === 'rabbit' ? 0.8 : this.tool === 'wolf' ? Infinity : Math.max(0.5, this.brush * 0.6);
        if (lastPaint && Math.hypot(wx - lastPaint[0], wy - lastPaint[1]) >= spacing) {
          lastPaint = [wx, wy];
          this.applyToolAt(wx, wy, true);
        }
        return;
      }
      if (e.pointerType !== 'touch') this.updateHover(x, y, e.clientX, e.clientY);
    });
    const up = (e: PointerEvent) => {
      const [x, y] = local(e);
      pointers.delete(e.pointerId);
      if (mode === 'pan' && moved < 6 && (this.tool === 'inspect' || e.pointerType === 'touch') && !this.demo && e.button === 0) {
        const [wx, wy] = this.renderer.cam.toWorld(x, y);
        this.inspectAt(wx, wy);
      }
      if (pointers.size === 0) {
        mode = 'none';
        lastPaint = null;
        this.worldWrap.classList.remove('panning');
      } else if (mode === 'pinch' && pointers.size === 1) mode = 'none';
      void downX;
      void downY;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => {
      if (mode === 'none') {
        this.hoverWorld = null;
        this.hoverUid = 0;
        this.floatTip.hide();
      }
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const [x, y] = local(e);
        const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        this.renderer.cam.zoomAt(f, x, y);
      },
      { passive: false },
    );

    window.addEventListener('keydown', (e) => {
      const tgt = e.target as HTMLElement;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'SELECT' || tgt.tagName === 'TEXTAREA') && e.key !== 'Escape') return;
      if (e.key === 'Escape') {
        if (this.modal.tryEscape()) return;
        this.selectedUid = 0;
        this.selectedTile = null;
        this.renderer.cam.follow = 0;
        this.updateInspector();
        return;
      }
      if (this.modal.isOpen) return;
      const cam = this.renderer.cam;
      const k = e.key;
      let handled = true;
      if (k === ' ') this.togglePlay();
      else if (k === 'n' || k === 'N') this.stepOnce();
      else if (k === 't' || k === 'T') this.cycleSpeed();
      else if (k >= '1' && k <= '5') this.setTool(TOOLS[Number(k) - 1]!.id);
      else if (k === '[') this.setBrush(this.brush - 0.5);
      else if (k === ']') this.setBrush(this.brush + 0.5);
      else if (k === '+' || k === '=') this.zoomBy(1.25);
      else if (k === '-' || k === '_') this.zoomBy(0.8);
      else if (k === '0') cam.fit();
      else if (k === 'ArrowLeft') cam.pan(60, 0);
      else if (k === 'ArrowRight') cam.pan(-60, 0);
      else if (k === 'ArrowUp') cam.pan(0, 60);
      else if (k === 'ArrowDown') cam.pan(0, -60);
      else if (k === 'f' || k === 'F') {
        if (this.selectedUid) cam.follow = cam.follow ? 0 : this.selectedUid;
        this.updateInspector();
      } else if (k === 'm' || k === 'M') this.toggleSound();
      else if (k === 'e' || k === 'E') this.openEncyclopedia();
      else if (k === 'h' || k === 'H' || k === '?') this.modal.open(helpScreen());
      else if (k === 'p' || k === 'P') this.showPerf = !this.showPerf;
      else handled = false;
      if (handled) e.preventDefault();
    });
  }

  // ───────────────────────── export ─────────────────────────

  exportCsv(): void {
    const w = this.session.world;
    const rows = [STR.csv.header];
    for (const d of w.history.days) {
      rows.push(
        [
          d.day + 1, d.plantCover.toFixed(1), d.rabbits, d.wolves, d.rabbitBirths, d.wolfBirths,
          d.rabbitDeaths.starved, d.rabbitDeaths.eaten, d.rabbitDeaths.old, d.rabbitDeaths.thirst,
          d.wolfDeaths.starved, d.wolfDeaths.old, d.wolfDeaths.thirst, d.shannon.toFixed(1),
        ].join(','),
      );
    }
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: fmt(STR.csv.filename, { day: w.day }) });
    document.body.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }
}
