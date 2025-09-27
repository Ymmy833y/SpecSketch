import type { Anchor, ScreenItem } from '@common/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mountOverlay: typeof import('@content/overlay').mountOverlay;
let renderItems: typeof import('@content/overlay').renderItems;
let clearOverlay: typeof import('@content/overlay').clearOverlay;
let highlightOverlay: typeof import('@content/overlay').highlightOverlay;
let getMissingIds: typeof import('@content/overlay').getMissingIds;

/** Provide immediate rAF to avoid flakiness and honor ordering guarantees. */
function installImmediateRaf() {
  const raf = (cb: FrameRequestCallback): number => {
    cb(0 as unknown as DOMHighResTimeStamp);
    return 1 as unknown as number;
  };
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: raf,
  });
}

const cssAnchor = (sel: string): Anchor => ({ type: 'css', value: sel }) as unknown as Anchor;

function makeItem(
  id: number,
  selector: string,
  opts?: {
    label?: number;
    color?: string;
    size?: number;
    shape?: string;
    position?: string;
    comment?: string;
  },
): ScreenItem {
  const {
    label = id,
    color = 'indigo',
    size = 12,
    shape = 'circle',
    position = 'left-top-outside',
    comment,
  } = opts ?? {};
  return {
    id,
    label,
    color,
    size,
    shape,
    position,
    comment,
    anchor: cssAnchor(selector),
  } as unknown as ScreenItem;
}

function getShadow(): ShadowRoot {
  const host = document.getElementById('spsk-root') as HTMLElement | null;
  expect(host).not.toBeNull();
  const shadow = (host as HTMLElement).shadowRoot;
  expect(shadow).not.toBeNull();
  return shadow as ShadowRoot;
}

function findBadgeByText(root: ParentNode, text: string): HTMLDivElement | undefined {
  const nodes = Array.from(root.querySelectorAll('.spsk-badge'));
  return nodes.find((n) => n.textContent === text) as HTMLDivElement | undefined;
}

function findCommentElFromBadge(badge?: HTMLDivElement | null): HTMLDivElement | null {
  if (!badge) return null;
  return badge.parentElement?.querySelector('.spsk-comment') as HTMLDivElement | null;
}

beforeEach(async () => {
  // Clean DOM and install immediate rAF per test
  document.body.innerHTML = '';
  installImmediateRaf();

  // Fresh module state for each test
  vi.resetModules();
  ({ mountOverlay, renderItems, clearOverlay, highlightOverlay, getMissingIds } = await import(
    '@content/overlay'
  ));
});

afterEach(async () => {
  // Try to clear overlay (if imported)
  if (typeof clearOverlay === 'function') {
    await clearOverlay();
  }
  document.getElementById('spsk-root')?.remove();
});

describe('content/overlay', () => {
  describe('mountOverlay', () => {
    it('mounts once and injects stylesheet into Shadow DOM', async () => {
      // Act
      await mountOverlay();
      await mountOverlay(); // idempotent

      // Assert
      const hosts = document.querySelectorAll('#spsk-root');
      expect(hosts.length).toBe(1);

      const shadow = getShadow();
      const links = shadow.querySelectorAll('link[rel="stylesheet"]');
      expect(links.length).toBe(1);

      const href = (links[0] as HTMLLinkElement).href;
      expect(href).toContain('/styles/overlay.css');

      const overlays = shadow.querySelectorAll('.spsk-overlay');
      expect(overlays.length).toBe(1);
    }, 3000);

    it('attaches scroll/resize listeners only once even on repeated mounts', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener');

      await mountOverlay();
      await mountOverlay(); // should NOT reattach listeners

      const scrollCalls = addSpy.mock.calls.filter(([ev]) => ev === 'scroll').length;
      const resizeCalls = addSpy.mock.calls.filter(([ev]) => ev === 'resize').length;

      expect(scrollCalls).toBe(1);
      expect(resizeCalls).toBe(1);

      addSpy.mockRestore();
    }, 3000);

    it('reuses existing #spsk-root host and .spsk-overlay if present', async () => {
      // Pre-seed existing host with ShadowRoot and overlay (no stylesheet link on purpose)
      const host = document.createElement('div');
      host.id = 'spsk-root';
      document.body.appendChild(host);
      const sr = host.attachShadow({ mode: 'open' });
      const existingOverlay = document.createElement('div');
      existingOverlay.className = 'spsk-overlay';
      sr.appendChild(existingOverlay);

      // Act
      await mountOverlay();

      // Assert: host is still one, overlay is still one (reused), stylesheet is exactly one
      const hosts = document.querySelectorAll('#spsk-root');
      expect(hosts.length).toBe(1);

      const shadow = getShadow();
      expect(shadow).toBe(sr);
      const overlays = shadow.querySelectorAll('.spsk-overlay');
      expect(overlays.length).toBe(1);

      const links = shadow.querySelectorAll('link[rel="stylesheet"]');
      expect(links.length).toBe(1);
      const href = (links[0] as HTMLLinkElement).href;
      expect(href).toContain('/styles/overlay.css');
    }, 3000);
  });

  describe('renderItems', () => {
    it('adds, updates, and removes boxes with color/shape/size/position applied', async () => {
      // Arrange
      document.body.innerHTML = `<div id="a"></div><div id="b"></div>`;
      const first: [ScreenItem, ScreenItem] = [
        makeItem(1, '#a', {
          label: 1,
          color: 'Indigo',
          size: 12,
          shape: 'circle',
          position: 'left-top-outside',
        }),
        makeItem(2, '#b', {
          label: 99,
          color: 'lime',
          size: 20,
          shape: 'square',
          position: 'right-top-outside',
        }),
      ];

      // Act: initial render
      await renderItems(first);

      // Assert: initial
      const shadow = getShadow();
      const boxes1 = shadow.querySelectorAll('.spsk-box');
      expect(boxes1.length).toBe(2);

      const badge1 = findBadgeByText(shadow, '1');
      const badge99 = findBadgeByText(shadow, '99');
      expect(badge1).toBeTruthy();
      expect(badge99).toBeTruthy();

      // color is lowercased in class names
      expect(badge1!.className).toContain('spsk-badge--indigo');
      expect(badge1!.className).toContain('spsk-badge--circle');
      expect(badge1!.className).toContain('spsk-badge--left-top-outside');
      expect(badge1!.style.fontSize).toBe('12px');

      expect(badge99!.className).toContain('spsk-badge--lime');
      expect(badge99!.className).toContain('spsk-badge--square');
      expect(badge99!.className).toContain('spsk-badge--right-top-outside');
      expect(badge99!.style.fontSize).toBe('20px');

      // position/size applied from getBoundingClientRect mock in dom.setup.ts
      const aBox = boxes1[0] as HTMLDivElement;
      expect(aBox.style.left).toBe('0px');
      expect(aBox.style.top).toBe('0px');
      expect(aBox.style.width).toBe('100px');
      expect(aBox.style.height).toBe('20px');
      // border width is size/4
      expect(aBox.style.getPropertyValue('--spsk-border-w')).toBe('3px');

      // Act: update item #1 (color/shape/size/position)
      const updated = [
        makeItem(1, '#a', {
          label: 1,
          color: 'Pink',
          size: 16,
          shape: 'square',
          position: 'top-outside',
        }),
        first[1],
      ];
      await renderItems(updated);

      // Assert: updated
      expect(badge1).toBeTruthy();
      expect(badge1!.className).toContain('spsk-badge--pink');
      expect(badge1!.className).toContain('spsk-badge--square');
      expect(badge1!.className).toContain('spsk-badge--top-outside');
      expect(badge1!.style.fontSize).toBe('16px');

      // Act: remove item #1 (diff remove)
      await renderItems([first[1]]);

      // Assert: one box remains with label "99" and "1" is gone
      expect(findBadgeByText(shadow, '99')).toBeTruthy();
      expect(findBadgeByText(shadow, '1')).toBeUndefined();
      expect(shadow.querySelectorAll('.spsk-box').length).toBe(1);
    }, 5000);

    it('does not duplicate DOM on update (Tracked entry is reused)', async () => {
      document.body.innerHTML = `<div id="x"></div>`;
      const i1 = makeItem(10, '#x', { label: 10, color: 'indigo', size: 12 });

      await renderItems([i1]);
      const shadow = getShadow();
      const firstBoxes = shadow.querySelectorAll('.spsk-box');
      expect(firstBoxes.length).toBe(1);

      // same id with different visual props → should update in place
      const i1b = makeItem(10, '#x', {
        label: 11,
        color: 'pink',
        size: 24,
        shape: 'square',
        position: 'top-inside',
      });
      await renderItems([i1b]);

      const secondBoxes = shadow.querySelectorAll('.spsk-box');
      expect(secondBoxes.length).toBe(1); // not duplicated

      const badge = findBadgeByText(shadow, '11');
      expect(badge).toBeTruthy();
      expect(badge!.className).toContain('spsk-badge--pink');
      expect(badge!.className).toContain('spsk-badge--square');
      expect(badge!.className).toContain('spsk-badge--top-inside');
      expect(badge!.style.fontSize).toBe('24px');

      // CSS var for border width = size/4
      const box = badge!.parentElement as HTMLDivElement;
      expect(box.style.getPropertyValue('--spsk-border-w')).toBe('6px');
    }, 5000);

    it('toggles comment visibility and font size, and keeps .spsk-comment class', async () => {
      document.body.innerHTML = `<div id="c"></div>`;
      const i = makeItem(1, '#c', { label: 1, comment: 'hello', size: 16 });

      await renderItems([i]);
      const shadow = getShadow();
      const badge = findBadgeByText(shadow, '1')!;
      const commentEl = findCommentElFromBadge(badge)!;

      // initial: visible with text and font-size
      expect(commentEl).toBeTruthy();
      expect(commentEl.className).toContain('spsk-comment');
      expect(commentEl.textContent).toBe('hello');
      expect(commentEl.style.display).toBe('inline');
      expect(commentEl.style.fontSize).toBe('16px');

      // update: remove comment -> hidden and cleared
      const iNoComment = makeItem(1, '#c', { label: 1, comment: '', size: 20 });
      await renderItems([iNoComment]);

      expect(commentEl.textContent).toBe('');
      expect(commentEl.style.display).toBe('none');
      // font-size may remain from previous style or be updated; after applyVisualState it should be updated to 20px when comment reappears

      // update: comment appears again with new size
      const iCommentAgain = makeItem(1, '#c', { label: 1, comment: 'world', size: 20 });
      await renderItems([iCommentAgain]);

      expect(commentEl.textContent).toBe('world');
      expect(commentEl.style.display).toBe('inline');
      expect(commentEl.style.fontSize).toBe('20px');
    }, 5000);

    it('removes all boxes when called with an empty array (diff remove)', async () => {
      document.body.innerHTML = `<div id="a"></div><div id="b"></div>`;
      await renderItems([makeItem(1, '#a'), makeItem(2, '#b')]);

      const shadow = getShadow();
      expect(shadow.querySelectorAll('.spsk-box').length).toBe(2);

      await renderItems([]); // disappear all

      expect(shadow.querySelectorAll('.spsk-box').length).toBe(0);
      expect(findBadgeByText(shadow, '1')).toBeUndefined();
      expect(findBadgeByText(shadow, '2')).toBeUndefined();
    }, 5000);
  });

  describe('getMissingIds', () => {
    it('reports missing when target not found, then recovers when element appears', async () => {
      // Arrange: no #missing element yet
      const item = makeItem(1, '#missing', { label: 1, color: 'indigo' });

      // Act: render when element is absent
      await renderItems([item]);

      // Assert: missing
      expect(getMissingIds()).toEqual([1]);
      const shadow = getShadow();
      const box = shadow.querySelector('.spsk-box') as HTMLDivElement;
      expect(box.style.display).toBe('none');

      // Act: add the element, re-render
      const el = document.createElement('div');
      el.id = 'missing';
      document.body.appendChild(el);
      await renderItems([item]);

      // Assert: recovered
      expect(getMissingIds()).toEqual([]);
      expect(box.style.display).toBe('');
    }, 5000);
  });

  describe('highlightOverlay', () => {
    it('toggles hovered class correctly and clears on null', async () => {
      // Arrange
      document.body.innerHTML = `<div id="a"></div><div id="b"></div>`;
      const items = [makeItem(1, '#a', { label: 1 }), makeItem(2, '#b', { label: 2 })];
      await renderItems(items);
      const shadow = getShadow();

      const boxOf = (label: number): HTMLDivElement => {
        const badge = findBadgeByText(shadow, String(label));
        expect(badge).toBeTruthy();
        return badge!.parentElement as HTMLDivElement;
      };

      // Act & Assert
      await highlightOverlay(1);
      expect(boxOf(1).classList.contains('is-hovered')).toBe(true);
      expect(boxOf(2).classList.contains('is-hovered')).toBe(false);

      // Same id (no change)
      await highlightOverlay(1);
      expect(boxOf(1).classList.contains('is-hovered')).toBe(true);

      // Switch to #2
      await highlightOverlay(2);
      expect(boxOf(1).classList.contains('is-hovered')).toBe(false);
      expect(boxOf(2).classList.contains('is-hovered')).toBe(true);

      // Clear
      await highlightOverlay(null);
      expect(boxOf(1).classList.contains('is-hovered')).toBe(false);
      expect(boxOf(2).classList.contains('is-hovered')).toBe(false);
    }, 5000);
  });

  describe('clearOverlay', () => {
    it('removes all nodes and resets missing tracking', async () => {
      // Arrange
      document.body.innerHTML = `<div id="a"></div>`;
      await renderItems([makeItem(10, '#a', { label: 10 })]);

      const shadow = getShadow();
      expect(shadow.querySelectorAll('.spsk-box').length).toBe(1);

      // Act
      await clearOverlay();

      // Assert
      expect(shadow.querySelectorAll('.spsk-box').length).toBe(0);
      expect(getMissingIds()).toEqual([]);
    }, 3000);
  });
});
