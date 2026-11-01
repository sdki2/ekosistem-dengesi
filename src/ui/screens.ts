import { DEFAULT_CONFIG, type SimConfig } from '../config';
import { STR, fmt } from '../content/i18n';
import { LEVELS, type LevelDef } from '../content/levels';
import { collapseNarrative, levelSummary } from '../game/narrative';
import type { Session } from '../game/session';
import type { SaveData } from '../game/storage';
import type { Species } from '../sim/agents';
import type { MapKind } from '../sim/grid';
import { randomSeed } from '../sim/rng';
import type { EventKind } from '../sim/world';
import { drawMiniHistory } from './charts/charts';
import { h } from './dom';

export function starsEl(n: number, total = 3): HTMLElement {
  const el = h('span', { class: 'stars', 'aria-label': fmt(STR.menu.stars, { n }) });
  for (let k = 0; k < total; k++) el.append(h('span', { class: k < n ? '' : 'off' }, '⭐'));
  return el;
}

// ───────────────────────── main menu ─────────────────────────

export function mainMenu(cb: { scenario(): void; sandbox(): void; encyclopedia(): void; tutorial(): void; totalStars: number }): HTMLElement {
  const M = STR.menu;
  return h(
    'div',
    {},
    h('div', { class: 'menu-hero' }, h('div', { class: 'big' }, '🌿🐇🐺'), h('h1', {}, STR.app.title), h('p', { class: 'sub' }, STR.app.subtitle)),
    h(
      'div',
      { class: 'menu-grid' },
      h('button', { class: 'menu-card', onclick: cb.scenario }, h('span', { class: 'ic' }, '🗺️'), h('b', {}, M.scenario), h('span', {}, M.scenarioDesc), cb.totalStars > 0 ? h('span', {}, `⭐ ${cb.totalStars}/${LEVELS.length * 3}`) : null),
      h('button', { class: 'menu-card', onclick: cb.sandbox }, h('span', { class: 'ic' }, '🧪'), h('b', {}, M.sandbox), h('span', {}, M.sandboxDesc)),
    ),
    h('div', { class: 'menu-links' }, h('button', { class: 'icon-btn', onclick: cb.encyclopedia }, '📖 ', M.encyclopedia), h('button', { class: 'icon-btn', onclick: cb.tutorial }, '🎓 ', M.tutorial)),
  );
}

export function levelSelect(save: SaveData, cb: { play(l: LevelDef): void; back(): void; reset(): void }): HTMLElement {
  const M = STR.menu;
  const grid = h('div', { class: 'level-grid' });
  LEVELS.forEach((L, i) => {
    const unlocked = i === 0 || (save.stars[LEVELS[i - 1]!.id] ?? 0) > 0;
    const info = STR.levels.list[i]!;
    const tags = [L.map === 'river' ? `🏞️ ${M.river}` : `🌲 ${M.forest}`, L.seasons ? '🍂' : '', L.weather ? '🌦️' : '', L.randomEvents ? '⚡' : ''].filter(Boolean).join(' ');
    grid.append(
      h(
        'button',
        { class: 'level-card', disabled: !unlocked, onclick: () => unlocked && cb.play(L), tip: unlocked ? info.intro : M.locked },
        h('span', { class: 'n' }, fmt(M.level, { n: L.id }), unlocked ? '' : ' 🔒'),
        h('b', {}, info.title),
        h('span', { class: 'meta' }, tags, ` · ${L.goal.days} gün · 💰${L.budget}`),
        starsEl(save.stars[L.id] ?? 0),
      ),
    );
  });
  return h(
    'div',
    {},
    h('h2', {}, '🗺️ ', M.scenario),
    h('p', { class: 'sub' }, M.scenarioDesc),
    grid,
    h(
      'div',
      { class: 'modal-actions' },
      h('button', { class: 'icon-btn', onclick: () => confirm(M.resetConfirm) && cb.reset() }, '↺ ', M.resetProgress),
      h('button', { class: 'icon-btn', onclick: cb.back }, '← ', M.back),
    ),
  );
}

export function levelIntro(L: LevelDef, cb: { start(): void; back(): void }): HTMLElement {
  const info = STR.levels.list[L.id - 1]!;
  return h(
    'div',
    {},
    h('h2', {}, fmt(STR.menu.level, { n: L.id }), ': ', info.title),
    h('p', {}, info.intro),
    h('div', { class: 'fact' }, h('b', {}, '🎯 ', STR.hud.goal), goalText(L)),
    h('p', { class: 'star-req' }, `⭐ ${STR.levels.star1} · ⭐⭐ ${fmt(STR.levels.star2, { n: L.stars.diversity })} · ⭐⭐⭐ ${fmt(STR.levels.star3, { n: Math.round(L.stars.budgetFrac * 100) })}`),
    h('div', { class: 'modal-actions' }, h('button', { class: 'icon-btn', onclick: cb.back }, '← ', STR.menu.back), h('button', { class: 'icon-btn primary', onclick: cb.start }, '▶ ', STR.menu.start)),
  );
}

export function goalText(L: LevelDef): string {
  const g = L.goal;
  if (g.kind === 'survive') return fmt(STR.levels.goalSurvive, { days: g.days });
  if (g.kind === 'recover') return fmt(STR.levels.goalRecover, { days: g.days, cover: g.minCover });
  return fmt(STR.levels.goalStable, { days: g.days, cv: g.maxCv.toFixed(2).replace('.', ',') });
}

export function sandboxSetup(cb: { start(o: { map: MapKind; seed: number; seasons: boolean; weather: boolean; deer?: number; randomEvents: boolean }): void; back(): void }): HTMLElement {
  const M = STR.menu;
  let map: MapKind = 'forest';
  const forest = h('button', { class: 'map-opt on', onclick: () => pick('forest') }, h('b', {}, '🌲 ', M.forest), h('span', {}, M.forestDesc));
  const river = h('button', { class: 'map-opt', onclick: () => pick('river') }, h('b', {}, '🏞️ ', M.river), h('span', {}, M.riverDesc));
  const pick = (m: MapKind) => {
    map = m;
    forest.classList.toggle('on', m === 'forest');
    river.classList.toggle('on', m === 'river');
  };
  const seed = h('input', { type: 'number', value: String(randomSeed() % 100000), min: '0', 'aria-label': M.seed });
  const seasons = h('input', { type: 'checkbox' });
  const weather = h('input', { type: 'checkbox', checked: true });
  const deer = h('input', { type: 'checkbox' });
  const events = h('input', { type: 'checkbox' });
  return h(
    'div',
    {},
    h('h2', {}, '🧪 ', M.sandbox),
    h('p', { class: 'sub' }, M.sandboxDesc),
    h('h4', {}, M.chooseMap),
    h('div', { class: 'map-pick' }, forest, river),
    h('div', { class: 'form-row' }, h('label', {}, M.seed), seed, h('button', { class: 'icon-btn', onclick: () => (seed.value = String(randomSeed() % 100000)) }, '🎲 ', M.randomSeed)),
    h('div', { class: 'form-row' }, h('label', { class: 'toggle' }, seasons, '🍂 ', M.seasons), h('label', { class: 'toggle' }, weather, '🌦️ ', M.weather), h('label', { class: 'toggle' }, deer, '🦌 ', M.deerHerd), h('label', { class: 'toggle' }, events, '⚡ ', M.randomEvents)),
    h(
      'div',
      { class: 'modal-actions' },
      h('button', { class: 'icon-btn', onclick: cb.back }, '← ', M.back),
      h('button', { class: 'icon-btn primary', onclick: () => cb.start({ map, seed: Number(seed.value) || 1, seasons: seasons.checked, weather: weather.checked, deer: deer.checked ? 12 : 0, randomEvents: events.checked }) }, '▶ ', M.start),
    ),
  );
}

// ───────────────────────── collapse ─────────────────────────

export function collapseScreen(s: Session, species: Species, day: number, cb: { retry(): void; rewind(): void; cont(): void; menu(): void }): HTMLElement {
  const C = STR.collapse;
  const story = collapseNarrative(s.world, species, day);
  const canvas = h('canvas', { class: 'mini-chart' });
  drawMiniHistory(canvas, s.world.history);
  const canRewind = s.canRewind(10);
  return h(
    'div',
    {},
    h('h2', {}, '💔 ', C.title),
    h('p', { class: 'sub' }, C.subtitle),
    h('div', { class: 'narrative' }, h('ol', {}, ...story.lines.map((l) => h('li', {}, l)))),
    canvas,
    story.lesson ? h('div', { class: 'lesson' }, '💡 ', story.lesson) : null,
    h(
      'div',
      { class: 'modal-actions' },
      h('button', { class: 'icon-btn', onclick: cb.menu }, '🏠 ', C.menu),
      s.mode === 'sandbox' ? h('button', { class: 'icon-btn', onclick: cb.cont }, '▶ ', C.continue) : null,
      h('button', { class: 'icon-btn', disabled: !canRewind, onclick: cb.rewind, tip: canRewind ? undefined : C.rewindNone }, '⏪ ', C.rewind),
      h('button', { class: 'icon-btn primary', onclick: cb.retry }, '↺ ', C.retry),
    ),
  );
}

export function goalFailedScreen(s: Session, cb: { retry(): void; rewind(): void; menu(): void }): HTMLElement {
  const L = s.level!;
  const canvas = h('canvas', { class: 'mini-chart' });
  drawMiniHistory(canvas, s.world.history);
  let detail = '';
  if (L.goal.kind === 'recover') detail = `🌱 %${s.recentCover(15).toFixed(0)} < %${L.goal.minCover}`;
  if (L.goal.kind === 'stable') detail = `CV ${s.rabbitCv().toFixed(2)} > ${L.goal.maxCv.toFixed(2)}`;
  return h(
    'div',
    {},
    h('h2', {}, '🎯 ', STR.hud.goal, ': ✗'),
    h('p', {}, goalText(L)),
    h('div', { class: 'narrative' }, detail),
    canvas,
    h(
      'div',
      { class: 'modal-actions' },
      h('button', { class: 'icon-btn', onclick: cb.menu }, '🏠 ', STR.collapse.menu),
      h('button', { class: 'icon-btn', disabled: !s.canRewind(10), onclick: cb.rewind }, '⏪ ', STR.collapse.rewind),
      h('button', { class: 'icon-btn primary', onclick: cb.retry }, '↺ ', STR.collapse.retry),
    ),
  );
}

// ───────────────────────── summary ─────────────────────────

export function summaryScreen(s: Session, stars: number, factIndex: number, cb: { next(): void; retry(): void; menu(): void; hasNext: boolean }): HTMLElement {
  const S = STR.summary;
  const L = s.level!;
  const spentFrac = s.startBudget > 0 ? s.spent / s.startBudget : 0;
  const sum = levelSummary(s.world, spentFrac, s.meanDiversity(), s.negativeEvents);
  const big = h('div', { class: 'big-stars', 'aria-label': fmt(STR.menu.stars, { n: stars }) });
  for (let k = 0; k < 3; k++) big.append(h('span', { style: k < stars ? '' : 'filter:grayscale(1);opacity:.3' }, '⭐'));
  const canvas = h('canvas', { class: 'mini-chart' });
  drawMiniHistory(canvas, s.world.history);
  return h(
    'div',
    {},
    h('h2', { style: 'text-align:center' }, S.winTitle),
    h('p', { class: 'sub', style: 'text-align:center' }, STR.levels.list[L.id - 1]!.title),
    big,
    h('p', { class: 'star-req' }, `⭐ ${STR.levels.star1} · ${stars >= 2 ? '✓' : '✗'} ${fmt(STR.levels.star2, { n: L.stars.diversity })} · ${s.spent <= s.startBudget * L.stars.budgetFrac ? '✓' : '✗'} ${fmt(STR.levels.star3, { n: Math.round(L.stars.budgetFrac * 100) })}`),
    h('div', { class: 'summary-cols' }, h('div', {}, h('b', {}, '👍 ', S.good), h('ul', {}, ...sum.good.map((x) => h('li', {}, x)))), h('div', {}, h('b', {}, '⚠️ ', S.bad), h('ul', {}, ...sum.bad.map((x) => h('li', {}, x))))),
    canvas,
    h('div', { class: 'fact' }, h('b', {}, '💡 ', S.fact), STR.facts[factIndex % STR.facts.length]!),
    h(
      'div',
      { class: 'modal-actions' },
      h('button', { class: 'icon-btn', onclick: cb.menu }, '🗺️ ', S.menu),
      h('button', { class: 'icon-btn', onclick: cb.retry }, '↺ ', S.retry),
      cb.hasNext ? h('button', { class: 'icon-btn primary', onclick: cb.next }, S.next, ' →') : null,
    ),
  );
}

// ───────────────────────── sandbox settings ─────────────────────────

interface SliderDef {
  label: string;
  get(c: SimConfig): number;
  set(c: SimConfig, v: number): void;
  min: number;
  max: number;
  step: number;
}

const SLIDERS: { group: keyof typeof STR.settings.groups; items: SliderDef[] }[] = [
  {
    group: 'plant',
    items: [{ label: STR.settings.regrowMul, get: (c) => c.plant.regrowMul, set: (c, v) => (c.plant.regrowMul = v), min: 0.1, max: 3, step: 0.05 }],
  },
  {
    group: 'rabbit',
    items: [
      { label: STR.settings.rabbitRepro, get: (c) => c.rabbit.reproCooldownDays, set: (c, v) => (c.rabbit.reproCooldownDays = v), min: 1, max: 20, step: 0.5 },
      { label: STR.settings.rabbitLitter, get: (c) => c.rabbit.litterMax, set: (c, v) => (c.rabbit.litterMax = v), min: 1, max: 6, step: 1 },
      { label: STR.settings.rabbitPlantEnergy, get: (c) => c.rabbit.plantEnergy, set: (c, v) => (c.rabbit.plantEnergy = v), min: 0.2, max: 2, step: 0.05 },
      { label: STR.settings.rabbitMetabolism, get: (c) => c.rabbit.metabolism, set: (c, v) => (c.rabbit.metabolism = v), min: 0.1, max: 1.5, step: 0.05 },
      { label: STR.settings.rabbitLifespan, get: (c) => c.rabbit.lifespanDays, set: (c, v) => (c.rabbit.lifespanDays = v), min: 5, max: 90, step: 1 },
      { label: STR.settings.rabbitVision, get: (c) => c.rabbit.vision, set: (c, v) => (c.rabbit.vision = v), min: 1, max: 10, step: 0.1 },
    ],
  },
  {
    group: 'wolf',
    items: [
      { label: STR.settings.wolfRepro, get: (c) => c.wolf.reproCooldownDays, set: (c, v) => (c.wolf.reproCooldownDays = v), min: 2, max: 40, step: 0.5 },
      { label: STR.settings.wolfPreyEnergy, get: (c) => c.wolf.preyEnergy, set: (c, v) => (c.wolf.preyEnergy = v), min: 5, max: 100, step: 1 },
      { label: STR.settings.wolfMetabolism, get: (c) => c.wolf.metabolism, set: (c, v) => (c.wolf.metabolism = v), min: 0.1, max: 1.5, step: 0.01 },
      { label: STR.settings.wolfLifespan, get: (c) => c.wolf.lifespanDays, set: (c, v) => (c.wolf.lifespanDays = v), min: 10, max: 200, step: 1 },
      { label: STR.settings.wolfVision, get: (c) => c.wolf.vision, set: (c, v) => (c.wolf.vision = v), min: 1, max: 12, step: 0.1 },
      { label: STR.settings.wolfCatch, get: (c) => c.wolf.catchChance, set: (c, v) => (c.wolf.catchChance = v), min: 0.05, max: 1, step: 0.01 },
    ],
  },
];

export function settingsScreen(s: Session, cb: { trigger(k: EventKind): void }): HTMLElement {
  const cfg = s.world.cfg;
  const T = STR.settings;
  const rows: { def: SliderDef; input: HTMLInputElement; out: HTMLOutputElement }[] = [];
  const body = h('div', {});
  for (const g of SLIDERS) {
    const grp = h('div', { class: 'settings-group' }, h('h4', {}, T.groups[g.group]));
    for (const def of g.items) {
      const out = h('output', {}, fmtV(def.get(cfg), def.step));
      const input = h('input', { type: 'range', min: String(def.min), max: String(def.max), step: String(def.step), value: String(def.get(cfg)), 'aria-label': def.label });
      input.addEventListener('input', () => {
        def.set(cfg, Number(input.value));
        out.textContent = fmtV(Number(input.value), def.step);
      });
      rows.push({ def, input, out });
      grp.append(h('div', { class: 'slider-row' }, h('span', {}, def.label), input, out));
    }
    body.append(grp);
  }
  const seasons = h('input', { type: 'checkbox', checked: s.world.seasonsEnabled });
  seasons.addEventListener('change', () => (s.world.seasonsEnabled = seasons.checked));
  const weather = h('input', { type: 'checkbox', checked: s.world.weatherEnabled });
  weather.addEventListener('change', () => (s.world.weatherEnabled = weather.checked));
  const events = h('input', { type: 'checkbox', checked: s.world.randomEvents });
  events.addEventListener('change', () => (s.world.randomEvents = events.checked));
  const reset = () => {
    for (const r of rows) {
      const v = r.def.get(DEFAULT_CONFIG);
      r.def.set(cfg, v);
      r.input.value = String(v);
      r.out.textContent = fmtV(v, r.def.step);
    }
  };
  return h(
    'div',
    {},
    h('h2', {}, '⚙️ ', T.title),
    h('div', { class: 'settings-group' }, h('h4', {}, T.groups.world), h('div', { class: 'form-row' }, h('label', { class: 'toggle' }, seasons, '🍂 ', T.seasons), h('label', { class: 'toggle' }, weather, '🌦️ ', T.weather), h('label', { class: 'toggle' }, events, '⚡ ', T.randomEvents))),
    h('div', { class: 'form-row' }, h('b', {}, T.triggerEvent, ':'), ...(['drought', 'disease', 'winter'] as EventKind[]).map((k) => h('button', { class: 'icon-btn', onclick: () => cb.trigger(k) }, STR.events.names[k]))),
    body,
    h('div', { class: 'modal-actions' }, h('button', { class: 'icon-btn', onclick: reset }, '↺ ', T.reset)),
  );
}

function fmtV(v: number, step: number): string {
  return step >= 1 ? String(Math.round(v)) : v.toFixed(step < 0.1 ? 2 : 1).replace('.', ',');
}

// ───────────────────────── encyclopedia ─────────────────────────

function diagram(id: string): HTMLElement | null {
  if (id === 'chain') {
    return h('div', { class: 'diagram', style: 'font-size:34px;display:flex;gap:10px;align-items:center;flex-wrap:wrap' }, '☀️', '→', '🌱', '→', '🐇', '→', '🐺', h('span', { style: 'font-size:14px;color:var(--ink-soft);font-weight:700' }, '  (+ 🍄 ayrıştırıcılar)'));
  }
  if (id === 'pyramid') {
    const bar = (w: number, c: string, t: string) => h('div', { style: `margin:3px auto;width:${w}%;background:${c};border-radius:8px;padding:6px;text-align:center;font-weight:800;font-size:13px` }, t);
    return h('div', { class: 'diagram' }, bar(25, '#a9bcdc', '🐺 ~%1'), bar(55, '#e9c48f', '🐇 ~%10'), bar(95, '#8fcf7e', '🌱 %100'));
  }
  if (id === 'cycle') {
    const svg = `<svg viewBox="0 0 300 90" width="100%" height="90" role="img" aria-label="Av-avcı döngüsü"><path d="M0 60 C 30 0, 60 0, 90 60 S 150 120, 180 60 S 240 0, 270 60" fill="none" stroke="#c98b4e" stroke-width="3"/><path d="M0 75 C 45 75, 60 20, 105 30 S 165 85, 195 75 S 255 20, 290 35" fill="none" stroke="#5f7fae" stroke-width="3" stroke-dasharray="7 4"/><text x="4" y="12" font-size="11" font-weight="800" fill="#c98b4e">🐇 av</text><text x="60" y="12" font-size="11" font-weight="800" fill="#5f7fae">🐺 avcı (gecikmeli)</text></svg>`;
    const d = h('div', { class: 'diagram' });
    d.innerHTML = svg;
    return d;
  }
  return null;
}

export function encyclopedia(startId?: string): HTMLElement {
  const cards = STR.encyclopedia.cards;
  const list = h('div', { class: 'ency-list', role: 'tablist' });
  const body = h('div', { class: 'ency-body', role: 'tabpanel' });
  const show = (id: string) => {
    const c = cards.find((x) => x.id === id) ?? cards[0]!;
    body.innerHTML = '';
    body.append(h('h3', {}, c.icon, ' ', c.title), h('p', {}, c.body));
    const d = diagram(c.id);
    if (d) body.append(d);
    for (const b of list.querySelectorAll('button')) b.classList.toggle('on', b.dataset.id === c.id);
  };
  for (const c of cards) {
    const b = h('button', { role: 'tab', onclick: () => show(c.id) }, c.icon, ' ', c.title);
    b.dataset.id = c.id;
    list.append(b);
  }
  show(startId ?? cards[0]!.id);
  return h('div', {}, h('h2', {}, '📖 ', STR.encyclopedia.title), h('div', { class: 'ency' }, list, body));
}

export function helpScreen(): HTMLElement {
  return h(
    'div',
    {},
    h('h2', {}, '⌨️ ', STR.help.title),
    h('table', { class: 'help-table' }, ...STR.help.rows.map(([k, v]) => h('tr', {}, h('td', {}, ...k.split('  ').map((x) => h('kbd', {}, x))), h('td', {}, v)))),
  );
}
