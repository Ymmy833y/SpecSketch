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
  opts?: { label?: number; color?: string; size?: number; shape?: string },
): ScreenItem {
  const { label = id, color = 'indigo', size = 12, shape = 'circle' } = opts ?? {};
  return {
    id,
    label,
    color,
    size,
    shape,
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
  });

  describe('renderItems', () => {
    it('adds, updates, and removes boxes with color/shape/size applied', async () => {
      // Arrange
      document.body.innerHTML = `<div id="a"></div><div id="b"></div>`;
      const first: [ScreenItem, ScreenItem] = [
        makeItem(1, '#a', { label: 1, color: 'Indigo', size: 12, shape: 'circle' }),
        makeItem(2, '#b', { label: 99, color: 'lime', size: 20, shape: 'square' }),
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
      expect(badge1!.className).toContain('spsk-badge-indigo');
      expect(badge1!.className).toContain('spsk-badge--circle');
      expect(badge1!.style.fontSize).toBe('12px');

      expect(badge99!.className).toContain('spsk-badge-lime');
      expect(badge99!.className).toContain('spsk-badge--square');
      expect(badge99!.style.fontSize).toBe('20px');

      // position/size applied from getBoundingClientRect mock in dom.setup.ts
      const aBox = boxes1[0] as HTMLDivElement;
      expect(aBox.style.left).toBe('0px');
      expect(aBox.style.top).toBe('0px');
      expect(aBox.style.width).toBe('100px');
      expect(aBox.style.height).toBe('20px');
      // border width is size/4
      expect(aBox.style.getPropertyValue('--spsk-border-w')).toBe('3px');

      // Act: update item #1 (color/shape/size)
      const updated = [
        makeItem(1, '#a', { label: 1, color: 'Pink', size: 16, shape: 'square' }),
        first[1],
      ];
      await renderItems(updated);

      // Assert: updated
      expect(badge1).toBeTruthy();
      expect(badge1!.className).toContain('spsk-badge-pink');
      expect(badge1!.className).toContain('spsk-badge--square');
      expect(badge1!.style.fontSize).toBe('16px');

      // Act: remove item #1 (diff remove)
      await renderItems([first[1]]);

      // Assert: one box remains with label "99"
      expect(findBadgeByText(shadow, '99')).toBeTruthy();
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
