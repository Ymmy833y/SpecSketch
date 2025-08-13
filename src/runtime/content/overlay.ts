import type { ScreenItem } from '@common/types';

let shadowRoot: ShadowRoot | null = null;
let rootEl: HTMLElement | null = null;

type Tracked = {
  boxEl: HTMLDivElement;
  badgeEl: HTMLDivElement;
  elRef: WeakRef<Element> | null;
  missing: boolean;
};
const tracked = new Map<number, Tracked>();

let rafPending = false;

/**
 * Mounts the on-page overlay (Shadow DOM) that draws selection boxes.
 * Also sets up scroll/resize listeners to reschedule position updates.
 *
 * @remarks Idempotent: repeated calls won't mount twice.
 */
export async function mountOverlay() {
  if (rootEl) return;
  const host = document.createElement('div');
  host.id = 'spsk-root';
  (document.documentElement || document.body).appendChild(host);
  shadowRoot = host.attachShadow({ mode: 'open' });

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('styles/overlay.css');
  shadowRoot.appendChild(link);

  rootEl = document.createElement('div');
  rootEl.className = 'spsk-overlay';
  shadowRoot.appendChild(rootEl);

  // Redraw trigger
  const schedule = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      updatePositions();
    });
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('scroll', schedule, { passive: true });
    window.visualViewport.addEventListener('resize', schedule, { passive: true });
  }
}

/**
 * Renders the given items into the overlay.
 * Applies add/update/remove by diffing against current state.
 *
 * @param items - Array of ScreenItem to display
 */
export async function renderItems(items: ScreenItem[]) {
  if (!rootEl) await mountOverlay();
  if (!rootEl) return;

  // Diff: remove disappeared items
  const ids = new Set(items.map(i => i.id));
  for (const [id, t] of tracked.entries()) {
    if (!ids.has(id)) {
      t.boxEl.remove();
      tracked.delete(id);
    }
  }

  // add/update
  for (const it of items) {
    let t = tracked.get(it.id);
    if (!t) {
      const box = document.createElement('div');
      box.className = 'spsk-box';

      const badge = document.createElement('div');
      badge.className = 'spsk-badge';
      box.appendChild(badge);

      rootEl!.appendChild(box);
      t = { boxEl: box, badgeEl: badge, elRef: null, missing: false };
      tracked.set(it.id, t);
    }
    t.badgeEl.textContent = String(it.label);
  }

  requestAnimationFrame(updatePositions);
}

/**
 * Clears the overlay and its internal tracking state.
 * Removes DOM nodes and resets the map.
 */
export async function clearOverlay() {
  if (!rootEl) return;
  rootEl.innerHTML = '';
  tracked.clear();
}

/**
 * Resolves an element by CSS selector using querySelector.
 *
 * @param cssSelector - CSS selector to query
 * @returns The first matching element or null
 */
function resolveElement(cssSelector: string): Element | null {
  try {
    return document.querySelector(cssSelector);
  } catch {
    return null;
  }
}

/**
 * Updates positions and sizes of all tracked boxes to match the latest layout.
 * Hides boxes temporarily when their target elements are not found.
 *
 * @remarks Intended to be called from requestAnimationFrame.
 */
function updatePositions() {
  for (const [_, t] of tracked.entries()) {
    // Check if the existing reference is still alive
    let el = t.elRef?.deref() ?? null;
    if (!el) {
      // The anchor always comes from Panel → Content during RENDER,
      // so store the CSS selector in boxEl.dataset.css
      const css = t.boxEl.dataset.css;
      if (!css) continue;
      el = resolveElement(css);
      t.elRef = el ? new WeakRef(el) : null;
      t.missing = !el;
    }

    if (!el) {
      // Lost: hide the box (adjust styles here if you want a faint placeholder)
      t.boxEl.style.display = 'none';
      continue;
    } else {
      t.boxEl.style.display = '';
    }

    const r = el.getBoundingClientRect();
    // The overlay is fixed-positioned, so apply viewport coordinates as-is
    t.boxEl.style.left = `${r.left}px`;
    t.boxEl.style.top = `${r.top}px`;
    t.boxEl.style.width = `${r.width}px`;
    t.boxEl.style.height = `${r.height}px`;
  }
}

/**
 * Associates CSS selectors (from RENDER) with tracked boxes.
 * Actual element resolution is handled in `updatePositions`.
 *
 * @param items - Items containing id and anchor
 */
export function bindCssSelectorMap(items: ScreenItem[]) {
  for (const it of items) {
    const t = tracked.get(it.id);
    if (!t) continue;
    t.boxEl.dataset.css = it.anchor.value;
    // Element resolution is handled in updatePositions
  }
}
