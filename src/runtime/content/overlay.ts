import type { Anchor, ScreenItem } from '@common/types';

let shadowRoot: ShadowRoot | null = null;
let rootEl: HTMLElement | null = null;

type Tracked = {
  anchor: Anchor;
  boxEl: HTMLDivElement;
  badgeEl: HTMLDivElement;
  elRef: WeakRef<Element> | null;
  missing: boolean;
};
const tracked = new Map<number, Tracked>();

let rafPending = false;

let hoveredId: number | null = null;

let listenersAttached = false;

/**
 * Mounts the on-page overlay (Shadow DOM) that draws selection boxes.
 * Also sets up scroll/resize listeners to reschedule position updates.
 *
 * @remarks Idempotent: repeated calls won't mount twice.
 */
export async function mountOverlay() {
  if (rootEl && shadowRoot) return;

  let host = document.getElementById('spsk-root') as HTMLElement | null;
  if (!host) {
    host = document.createElement('div');
    host.id = 'spsk-root';
    (document.documentElement || document.body).appendChild(host);
  }

  shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });

  const cssHref = chrome.runtime.getURL('styles/overlay.css');
  let link = shadowRoot.querySelector<HTMLLinkElement>(`link[rel="stylesheet"][href="${cssHref}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssHref;
    shadowRoot.appendChild(link);
  }

  rootEl = shadowRoot.querySelector<HTMLElement>('div.spsk-overlay');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.className = 'spsk-overlay';
    shadowRoot.appendChild(rootEl);
  }

  if (!listenersAttached) {
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
    listenersAttached = true;
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
  const ids = new Set(items.map((i) => i.id));
  for (const [id, t] of tracked.entries()) {
    if (!ids.has(id)) {
      t.boxEl.remove();
      tracked.delete(id);
    }
  }

  // add/update
  for (const it of items) {
    let t = tracked.get(it.id);
    const color = it.color.toLowerCase();
    if (t) {
      t.boxEl.className = `spsk-box spsk-box-${color}`;
      t.boxEl.style.setProperty('--spsk-border-w', `${it.size / 4}px`);
      t.badgeEl.className = `spsk-badge spsk-badge--${it.shape} spsk-badge-${color} spsk-badge--${it.position}`;
      t.badgeEl.style.fontSize = `${it.size}px`;
    } else {
      const box = document.createElement('div');
      box.className = `spsk-box spsk-box-${color}`;
      box.style.setProperty('--spsk-border-w', `${it.size / 4}px`);

      const badge = document.createElement('div');
      badge.className = `spsk-badge spsk-badge--${it.shape} spsk-badge-${color} spsk-badge--${it.position}`;
      badge.style.fontSize = `${it.size}px`;
      box.appendChild(badge);

      rootEl!.appendChild(box);
      t = { anchor: it.anchor, boxEl: box, badgeEl: badge, elRef: null, missing: true };
      tracked.set(it.id, t);
    }
    t.badgeEl.textContent = String(it.label);
  }

  await waitForPositionsApplied();
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
 * Switches the hover highlight to the specified overlay.
 *
 * @param id - Overlay identifier to highlight, or `null` to clear the highlight.
 */
export async function highlightOverlay(id: number | null) {
  if (id === hoveredId) return;

  const prev = hoveredId;
  hoveredId = id;

  if (prev != null) {
    tracked.get(prev)?.boxEl.classList.remove('is-hovered');
  }
  if (id != null) {
    tracked.get(id)?.boxEl.classList.add('is-hovered');
  }
}

/**
 * Returns the IDs of tracked items whose target elements are currently missing.
 *
 * @returns Array of item IDs that are marked as missing.
 */
export function getMissingIds() {
  return Array.from(tracked.entries())
    .filter(([, t]) => t.missing)
    .map(([id]) => id);
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
 * Waits for the next animation frame and applies a single layout update.
 *
 * @returns This guarantees ordering of the update, not the visual paint itself.
 */
function waitForPositionsApplied(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      updatePositions();
      resolve();
    });
  });
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
    const el = resolveElement(t.anchor.value);
    t.elRef = el ? new WeakRef(el) : null;

    if (!el) {
      // Lost: hide the box (adjust styles here if you want a faint placeholder)
      t.boxEl.style.display = 'none';
      t.missing = true;
      continue;
    } else {
      t.boxEl.style.display = '';
      t.missing = false;
    }

    const r = el.getBoundingClientRect();
    // The overlay is fixed-positioned, so apply viewport coordinates as-is
    t.boxEl.style.left = `${r.left}px`;
    t.boxEl.style.top = `${r.top}px`;
    t.boxEl.style.width = `${r.width}px`;
    t.boxEl.style.height = `${r.height}px`;
  }
}
