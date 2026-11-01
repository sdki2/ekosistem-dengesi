import { STR } from '../content/i18n';
import { h } from './dom';

/** Step-by-step spotlight tutorial. Targets are CSS selectors (null = centred). */
const TARGETS: (string | null)[] = [null, '.world-wrap', '.toolbar', '.time-controls', '.stats', '#btn-ency'];

export function runTutorial(onDone: () => void, onStep?: (i: number) => void): void {
  const steps = STR.tutorial.steps;
  let i = 0;
  const hole = h('div', { class: 'tut-hole' });
  const arrow = h('div', { class: 'tut-arrow', 'aria-hidden': 'true' }, '👇');
  const title = h('h3');
  const text = h('p');
  const dots = h('div', { class: 'dots' });
  const prev = h('button', { class: 'icon-btn', onclick: () => go(i - 1) }, STR.tutorial.prev);
  const next = h('button', { class: 'icon-btn primary', onclick: () => go(i + 1) }, STR.tutorial.next);
  const skip = h('button', { class: 'icon-btn', onclick: () => end() }, STR.tutorial.skip);
  const bubble = h('div', { class: 'tut-bubble', role: 'dialog', 'aria-live': 'polite' }, title, text, h('div', { class: 'tut-nav' }, dots, skip, prev, next));
  document.body.append(hole, arrow, bubble);
  for (let k = 0; k < steps.length; k++) dots.append(h('i'));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') end();
    else if (e.key === 'ArrowRight' || e.key === 'Enter') go(i + 1);
    else if (e.key === 'ArrowLeft') go(i - 1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener('keydown', onKey, true);
  const onResize = () => place();
  window.addEventListener('resize', onResize);

  function place(): void {
    const sel = TARGETS[i];
    let el = sel ? document.querySelector<HTMLElement>(sel) : null;
    if (el && (el.offsetParent === null && getComputedStyle(el).position !== 'fixed')) el = null;
    const bw = Math.min(340, window.innerWidth - 24);
    if (!el) {
      hole.style.cssText = `left:${window.innerWidth / 2}px;top:${window.innerHeight / 2}px;width:0;height:0;`;
      arrow.style.display = 'none';
      bubble.style.left = `${(window.innerWidth - bw) / 2}px`;
      bubble.style.top = `${window.innerHeight / 2 - 90}px`;
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 6;
    const top = Math.max(4, r.top - pad);
    const bottom = Math.min(window.innerHeight - 4, r.bottom + pad);
    hole.style.cssText = `left:${r.left - pad}px;top:${top}px;width:${r.width + pad * 2}px;height:${bottom - top}px;`;
    // bubble: below target if room, else above, else inside
    const bh = bubble.offsetHeight || 170;
    let by = bottom + 18;
    let arrowUp = true;
    if (by + bh > window.innerHeight - 8) {
      by = top - bh - 18;
      arrowUp = false;
    }
    if (by < 8) {
      by = Math.max(8, top + (bottom - top) / 2 - bh / 2);
    }
    const bx = Math.max(12, Math.min(window.innerWidth - bw - 12, r.left + r.width / 2 - bw / 2));
    bubble.style.left = `${bx}px`;
    bubble.style.top = `${by}px`;
    arrow.style.display = '';
    arrow.textContent = arrowUp ? '👆' : '👇';
    arrow.style.left = `${Math.max(8, Math.min(window.innerWidth - 40, r.left + r.width / 2 - 16))}px`;
    arrow.style.top = `${arrowUp ? bottom - 4 : top - 36}px`;
  }

  function go(k: number): void {
    if (k < 0) return;
    if (k >= steps.length) return end();
    i = k;
    onStep?.(i);
    title.textContent = steps[i]!.title;
    text.textContent = steps[i]!.text;
    dots.querySelectorAll('i').forEach((d, j) => d.classList.toggle('on', j === i));
    prev.toggleAttribute('disabled', i === 0);
    next.textContent = i === steps.length - 1 ? STR.tutorial.done : STR.tutorial.next;
    requestAnimationFrame(place);
    next.focus();
  }

  function end(): void {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    hole.remove();
    arrow.remove();
    bubble.remove();
    onDone();
  }

  go(0);
}
