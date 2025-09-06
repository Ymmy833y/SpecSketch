import '@testing-library/jest-dom';

import { Selector } from '@content/selector';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type RectInit = { left: number; top: number; width: number; height: number };

function setRect(el: HTMLElement, r: RectInit): void {
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () =>
      ({
        x: r.left,
        y: r.top,
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        right: r.left + r.width,
        bottom: r.top + r.height,
        toJSON() {},
      }) as DOMRect,
  });
}

function mouseover(target: EventTarget): void {
  const ev = new MouseEvent('mouseover', { bubbles: true, cancelable: true });
  (target as HTMLElement).dispatchEvent(ev);
}

function click(target: EventTarget): MouseEvent {
  const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
  (target as HTMLElement).dispatchEvent(ev);
  return ev;
}

describe('content/selector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('creates a single hover box on first mouseover and positions it (enable)', () => {
    // Arrange
    const onPick = vi.fn((_: Element) => undefined);
    const sel = new Selector(onPick);
    const a = document.createElement('button');
    document.body.appendChild(a);
    setRect(a, { left: 10, top: 20, width: 110, height: 22 });

    // Act
    sel.setEnabled(true);
    mouseover(a);

    // Assert
    const hover = document.body.lastElementChild as HTMLDivElement | null;
    expect(hover).toBeTruthy();
    expect(hover?.style.position).toBe('absolute');
    expect(hover?.style.pointerEvents).toBe('none');
    expect(hover?.style.left).toBe('10px');
    expect(hover?.style.top).toBe('20px');
    expect(hover?.style.width).toBe('110px');
    expect(hover?.style.height).toBe('22px');

    // Even if you mouse over again, the box remains the same
    const beforeCount = document.querySelectorAll('div').length;
    mouseover(a);
    const afterCount = document.querySelectorAll('div').length;
    expect(afterCount).toBe(beforeCount);
    sel.setEnabled(false);
  });

  it('repositions the same hover box when moving to another element', () => {
    // Arrange
    const sel = new Selector(() => undefined);
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);
    setRect(a, { left: 5, top: 6, width: 50, height: 16 });
    setRect(b, { left: 30, top: 40, width: 80, height: 18 });

    sel.setEnabled(true);
    mouseover(a);
    const hover = document.body.lastElementChild as HTMLDivElement;

    // Act
    mouseover(b);

    // Assert
    expect(document.body.lastElementChild).toBe(hover);
    expect(hover.style.left).toBe('30px');
    expect(hover.style.top).toBe('40px');
    expect(hover.style.width).toBe('80px');
    expect(hover.style.height).toBe('18px');
    sel.setEnabled(false);
  });

  it('removes the hover box on disable and does not recreate after disabling', () => {
    // Arrange
    const sel = new Selector(() => undefined);
    const el = document.createElement('div');
    document.body.appendChild(el);
    setRect(el, { left: 0, top: 0, width: 100, height: 20 });

    sel.setEnabled(true);
    mouseover(el);
    const hover = document.body.lastElementChild;

    // Act
    sel.setEnabled(false);

    // Assert
    expect(document.body.contains(hover)).toBe(false);

    // It doesn't come back even if you mouse over it again.
    mouseover(el);
    expect(document.body.lastElementChild).not.toBe(hover);
    // hover is not newly generated (the last child is still el or another element)
    expect(document.body.querySelectorAll('div').length).toBeGreaterThanOrEqual(1);
    // At least there is no absolute+pointer-none hover-like thing.
    const maybeHover = Array.from(document.body.querySelectorAll('div')).find(
      (d) =>
        (d as HTMLElement).style.pointerEvents === 'none' &&
        (d as HTMLElement).style.position === 'absolute',
    );
    expect(maybeHover).toBeUndefined();
  });

  it('confirms selection on click with default prevented and propagation stopped', () => {
    // Arrange
    const onPick = vi.fn((_: Element) => undefined);
    const sel = new Selector(onPick);
    const btn = document.createElement('button');
    document.body.appendChild(btn);

    sel.setEnabled(true);

    // Spy on Event.prototype to see stopPropagation calls
    const stopSpy = vi.spyOn(Event.prototype, 'stopPropagation');

    // Act
    const ev = click(btn);

    // Assert
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(btn);
    expect(ev.defaultPrevented).toBe(true);
    expect(stopSpy).toHaveBeenCalled();

    sel.setEnabled(false);
    stopSpy.mockRestore();
  });

  it('ignores clicks while disabled (no onPick, no preventDefault)', () => {
    // Arrange
    const onPick = vi.fn((_: Element) => undefined);
    const sel = new Selector(onPick);
    const btn = document.createElement('button');
    document.body.appendChild(btn);

    sel.setEnabled(false);

    // Act
    const ev = click(btn);

    // Assert
    expect(onPick).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it('ignores non-element targets for mouseover and click', () => {
    // Arrange
    const onPick = vi.fn((_: Element) => undefined);
    const sel = new Selector(onPick);
    sel.setEnabled(true);

    // Act: Fires on the document (not the Element) as the target
    const mo = new MouseEvent('mouseover', { bubbles: true, cancelable: true });
    document.dispatchEvent(mo);

    const clk = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.dispatchEvent(clk);

    sel.setEnabled(false);
    // Assert
    const maybeHover = Array.from(document.body.querySelectorAll('div')).find(
      (d) =>
        (d as HTMLElement).style.pointerEvents === 'none' &&
        (d as HTMLElement).style.position === 'absolute',
    );
    expect(maybeHover).toBeUndefined();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('is idempotent when enabling with the same value repeatedly', () => {
    // Arrange
    const onPick = vi.fn((_: Element) => undefined);
    const sel = new Selector(onPick);
    const btn = document.createElement('button');
    document.body.appendChild(btn);

    sel.setEnabled(true);
    sel.setEnabled(true);

    // Act
    click(btn);
    click(btn);

    // Assert: Click twice → Called only twice (no duplicate subscriptions)
    expect(onPick).toHaveBeenCalledTimes(2);
    sel.setEnabled(false);
  });
});
