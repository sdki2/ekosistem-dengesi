import { STR, fmt, num } from '../content/i18n';
import type { Session } from '../game/session';
import { BIOMASS } from '../sim/stats';
import { PhasePlot, PopulationChart, PyramidChart } from './charts/charts';
import { animateNumber, h } from './dom';

/** Right-hand statistics panel (bottom drawer on tablets). */
export class StatsPanel {
  el: HTMLElement;
  private vals: Record<string, HTMLElement> = {};
  private trends: Record<string, HTMLElement> = {};
  private pop: PopulationChart;
  private pyr: PyramidChart;
  private phase: PhasePlot;
  private phaseSection: HTMLElement;
  private pyrMsg: HTMLElement;
  private gaugeKnob: HTMLElement;
  private divVal: HTMLElement;
  private today: HTMLElement;
  private handleMini: HTMLElement;
  reducedMotion = false;
  /** called when the pyramid status changes to 'bad' */
  onPyramidBad: (() => void) | null = null;
  onExport: (() => void) | null = null;
  private lastPyr: 'ok' | 'warn' | 'bad' = 'ok';

  constructor() {
    const S = STR.stats;
    const counter = (key: string, icon: string, label: string) => {
      const val = h('span', { class: 'val' }, '0');
      const tr = h('span', { class: 'trend flat', 'aria-hidden': 'true' }, '•');
      this.vals[key] = val;
      this.trends[key] = tr;
      return h('div', { class: 'counter', tip: label }, h('div', { class: 'ic' }, icon), h('div', {}, val, tr), h('div', { class: 'lbl' }, label));
    };
    const popCanvas = h('canvas', { 'aria-label': S.population, role: 'img' });
    this.pop = new PopulationChart(popCanvas);
    const seg = h('div', { class: 'seg', role: 'group' });
    const b50 = h('button', { class: 'on', onclick: () => setWin('last50') }, S.last50);
    const bAll = h('button', { onclick: () => setWin('all') }, S.all);
    seg.append(b50, bAll);
    const setWin = (w: 'last50' | 'all') => {
      this.pop.window = w;
      b50.classList.toggle('on', w === 'last50');
      bAll.classList.toggle('on', w === 'all');
    };
    const pyrCanvas = h('canvas', { 'aria-label': S.pyramid, role: 'img' });
    this.pyr = new PyramidChart(pyrCanvas);
    this.pyrMsg = h('div', { class: 'pyr-msg ok' }, '✓');
    this.gaugeKnob = h('i');
    this.divVal = h('span', { class: 'val' }, '0');
    this.today = h('div', { class: 'minirow' });
    const phaseCanvas = h('canvas', { 'aria-label': S.phase, role: 'img' });
    this.phase = new PhasePlot(phaseCanvas);
    this.phaseSection = h('div', { class: 'section' }, h('h4', {}, '🔄 ', S.phase, h('span', { class: 'info', tip: S.phaseTip }, 'ⓘ')), h('div', { class: 'chart-wrap' }, phaseCanvas));
    this.handleMini = h('span', { class: 'mini' });

    this.el = h(
      'aside',
      { class: 'stats', 'aria-label': S.title },
      h('button', { class: 'drawer-handle', onclick: () => this.el.classList.toggle('open'), 'aria-label': S.drawer }, h('span', { class: 'grip' }), '📊 ', S.drawer, this.handleMini),
      h('div', { class: 'section' }, h('div', { class: 'counters' }, counter('plants', '🌱', S.plantCover), counter('rabbits', '🐇', STR.species.rabbits), counter('wolves', '🐺', STR.species.wolves)), this.today),
      h('div', { class: 'section-grid' },
        h('div', { class: 'section' },
          h('h4', {}, '📈 ', S.population, seg),
          h('div', { class: 'chart-wrap' }, popCanvas),
          h('div', { class: 'legend' },
            h('span', { style: 'color:var(--rabbit)' }, h('i', { style: 'background:var(--rabbit)' }), '🐇 ', STR.species.rabbits),
            h('span', { style: 'color:var(--wolf)' }, h('i', { class: 'dash', style: 'background:var(--wolf)' }), '🐺 ', STR.species.wolves, ' ×10'),
            h('span', { style: 'color:var(--plant)' }, h('i', { class: 'dash', style: 'background:var(--plant)' }), '🌱 %'),
          ),
        ),
        h('div', { class: 'section' }, h('h4', {}, '🔺 ', S.pyramid, h('span', { class: 'info', tip: S.pyramidTip }, 'ⓘ')), h('div', { class: 'chart-wrap' }, pyrCanvas), this.pyrMsg),
        h('div', { class: 'section' }, h('h4', {}, '🦋 ', S.biodiversity, h('span', { class: 'info', tip: S.biodiversityTip }, 'ⓘ')), h('div', { class: 'diversity', tip: S.biodiversityTip }, h('div', { class: 'gauge' }, this.gaugeKnob), this.divVal)),
        this.phaseSection,
        h('div', { class: 'export-row' }, h('button', { class: 'icon-btn', onclick: () => this.onExport?.() }, '⬇️ ', S.exportCsv)),
      ),
    );
  }

  showPhase(on: boolean): void {
    this.phaseSection.style.display = on ? '' : 'none';
  }

  private setTrend(key: string, delta: number, eps: number): void {
    const el = this.trends[key]!;
    const S = STR.stats;
    const cls = delta > eps ? 'up' : delta < -eps ? 'down' : 'flat';
    el.className = `trend ${cls}`;
    el.textContent = cls === 'up' ? '▲' : cls === 'down' ? '▼' : '•';
    el.parentElement!.parentElement!.setAttribute('aria-label', `${cls === 'up' ? S.trendUp : cls === 'down' ? S.trendDown : S.trendFlat}`);
  }

  /** cheap numeric refresh (~4×/s) */
  updateNumbers(s: Session): void {
    const w = s.world;
    const hist = w.history;
    const n = hist.t.length;
    const back = Math.max(0, n - 1 - 8); // ~2 days ago
    const cover = w.plantCover();
    animateNumber(this.vals.plants!, cover, (v) => `%${v.toFixed(0)}`, this.reducedMotion);
    animateNumber(this.vals.rabbits!, w.counts[0], (v) => num(Math.round(v)), this.reducedMotion);
    animateNumber(this.vals.wolves!, w.counts[1], (v) => num(Math.round(v)), this.reducedMotion);
    if (n > 1) {
      this.setTrend('plants', cover - hist.plants[back]!, 1);
      this.setTrend('rabbits', w.counts[0] - hist.rabbits[back]!, Math.max(1, hist.rabbits[back]! * 0.03));
      this.setTrend('wolves', w.counts[1] - hist.wolves[back]!, 0.5);
    }
    const t = w.today;
    const S = STR.stats;
    const deaths = (d: Record<string, number>) => Object.values(d).reduce((a, b) => a + b, 0);
    this.today.innerHTML = '';
    this.today.append(
      h('span', {}, `${S.birthsToday}: `, h('b', {}, `🐇${t.rabbitBirths} 🐺${t.wolfBirths}`)),
      h('span', {}, `${S.deathsToday}: `, h('b', {}, `🐇${deaths(t.rabbitDeaths)} 🐺${deaths(t.wolfDeaths)}`)),
    );
    const score = w.diversity();
    this.gaugeKnob.style.left = `${Math.max(0, Math.min(100, score))}%`;
    animateNumber(this.divVal, score, (v) => v.toFixed(0), this.reducedMotion);
    this.handleMini.textContent = `🌱%${cover.toFixed(0)} · 🐇${w.counts[0]} · 🐺${w.counts[1]}`;
  }

  /** chart redraw (~every frame when visible; cheap) */
  updateCharts(s: Session, showPhase: boolean): void {
    const w = s.world;
    const visible = this.el.offsetParent !== null || this.el.classList.contains('open');
    if (!visible) return;
    this.pop.draw(w.history);
    let plantB = 0;
    for (let i = 0; i < w.grid.plant.length; i++) plantB += w.grid.plant[i]!;
    const status = this.pyr.update(
      { plants: Math.round((plantB / 100) * BIOMASS.plantTile), rabbits: Math.round(w.counts[0] * BIOMASS.rabbit), wolves: Math.round(w.counts[1] * BIOMASS.wolf) },
      this.reducedMotion,
    );
    if (status !== this.lastPyr) {
      this.lastPyr = status;
      this.pyrMsg.className = `pyr-msg ${status}`;
      this.pyrMsg.textContent = status === 'bad' ? STR.stats.pyramidInverted : status === 'warn' ? STR.stats.pyramidWarn : fmt('✓ {t}', { t: STR.stats.pyramid });
      if (status === 'bad') this.onPyramidBad?.();
    }
    if (showPhase) this.phase.draw(w.history);
  }
}
