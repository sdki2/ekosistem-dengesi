type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown> & { class?: string; style?: string; tip?: string };

/** Tiny hyperscript helper: h('button', { class: 'x', onclick }, 'text') */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else if (k === 'tip') el.dataset.tip = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** global hover tooltips: any element with data-tip */
export function installTooltips(): void {
  const tip = h('div', { class: 'tooltip', role: 'tooltip' });
  document.body.append(tip);
  let current: HTMLElement | null = null;
  const show = (el: HTMLElement, x: number, y: number) => {
    const text = el.dataset.tip;
    if (!text) return;
    tip.innerHTML = text;
    tip.classList.add('show');
    position(x, y);
  };
  const position = (x: number, y: number) => {
    const r = tip.getBoundingClientRect();
    let tx = x + 14;
    let ty = y + 16;
    if (tx + r.width > window.innerWidth - 8) tx = x - r.width - 10;
    if (ty + r.height > window.innerHeight - 8) ty = y - r.height - 10;
    tip.style.left = `${Math.max(6, tx)}px`;
    tip.style.top = `${Math.max(6, ty)}px`;
  };
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const el = (e.target as HTMLElement).closest?.('[data-tip]') as HTMLElement | null;
    if (el !== current) {
      current = el;
      if (el) show(el, e.clientX, e.clientY);
      else tip.classList.remove('show');
    }
  });
  document.addEventListener('pointermove', (e) => {
    if (current) position(e.clientX, e.clientY);
  });
  document.addEventListener('pointerdown', () => {
    tip.classList.remove('show');
    current = null;
  });
  // keyboard focus shows tips too
  document.addEventListener('focusin', (e) => {
    const el = (e.target as HTMLElement).closest?.('[data-tip]') as HTMLElement | null;
    if (el) {
      const r = el.getBoundingClientRect();
      current = el;
      show(el, r.left, r.bottom);
    }
  });
  document.addEventListener('focusout', () => {
    tip.classList.remove('show');
    current = null;
  });
}

/** world-canvas tooltip (driven manually) */
export class FloatingTip {
  el = h('div', { class: 'tooltip' });
  constructor() {
    document.body.append(this.el);
  }
  show(html: string, x: number, y: number): void {
    this.el.innerHTML = html;
    this.el.classList.add('show');
    const r = this.el.getBoundingClientRect();
    let tx = x + 16;
    let ty = y + 18;
    if (tx + r.width > window.innerWidth - 8) tx = x - r.width - 12;
    if (ty + r.height > window.innerHeight - 8) ty = y - r.height - 12;
    this.el.style.left = `${tx}px`;
    this.el.style.top = `${ty}px`;
  }
  hide(): void {
    this.el.classList.remove('show');
  }
}

export class Modal {
  root = h('div', { class: 'modal-root', role: 'dialog', 'aria-modal': 'true' });
  private onClose: (() => void) | null = null;
  private dismissable = true;

  constructor() {
    document.body.append(this.root);
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root && this.dismissable) this.close();
    });
  }

  get isOpen(): boolean {
    return this.root.classList.contains('open');
  }

  open(content: HTMLElement, opts: { wide?: boolean; dismissable?: boolean; onClose?: () => void } = {}): void {
    clear(this.root);
    const box = h('div', { class: `modal${opts.wide ? ' wide' : ''}` }, content);
    this.dismissable = opts.dismissable !== false;
    if (this.dismissable) box.append(h('button', { class: 'icon-btn close', 'aria-label': 'Kapat', onclick: () => this.close() }, '✕'));
    this.root.append(box);
    this.root.classList.add('open');
    this.onClose = opts.onClose ?? null;
    const focusable = box.querySelector<HTMLElement>('button:not(.close), [tabindex], input');
    focusable?.focus();
  }

  close(): void {
    if (!this.isOpen) return;
    this.root.classList.remove('open');
    clear(this.root);
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
  }

  /** Esc handling */
  tryEscape(): boolean {
    if (this.isOpen && this.dismissable) {
      this.close();
      return true;
    }
    return false;
  }
}

/** animate a number change in an element */
export function animateNumber(el: HTMLElement, to: number, format: (n: number) => string, reduced: boolean): void {
  const from = Number(el.dataset.v ?? to);
  el.dataset.v = String(to);
  if (reduced || from === to) {
    el.textContent = format(to);
    return;
  }
  const t0 = performance.now();
  const dur = 350;
  const tick = (now: number) => {
    const t = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = format(from + (to - from) * e);
    if (t < 1 && el.dataset.v === String(to)) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
