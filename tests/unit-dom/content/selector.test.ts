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

function pointerdown(target: EventTarget, init?: PointerEventInit): PointerEvent {
  const options: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    button: 0,
    isPrimary: true,
    ...init,
  };

  let ev: Event;
  if (typeof PointerEvent !== 'undefined') {
    ev = new PointerEvent('pointerdown', options);
  } else {
    const me = new MouseEvent('pointerdown', options);
    if (!('isPrimary' in me)) {
      Object.defineProperty(me, 'isPrimary', { value: true });
    }
    ev = me as unknown as PointerEvent;
  }

  (target as HTMLElement).dispatchEvent(ev);
  return ev as PointerEvent;
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

  it('click is cancelled and propagation stopped when enabled (no onPick)', () => {
    // Arrange
    const onPick = vi.fn((_: Element) => undefined);
    const sel = new Selector(onPick);
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    sel.setEnabled(true);

    const stopSpy = vi.spyOn(Event.prototype, 'stopPropagation');
    const stopImmediateSpy = vi.spyOn(
      Event.prototype as unknown as { stopImmediatePropagation: () => void },
      'stopImmediatePropagation',
    );

    // Act
    const ev = click(btn);

    // Assert
    expect(onPick).not.toHaveBeenCalled();

    expect(ev.defaultPrevented).toBe(true);
    expect(stopSpy).toHaveBeenCalled();
    expect(stopImmediateSpy).toHaveBeenCalled();

    // Cleanup
    sel.setEnabled(false);
    stopSpy.mockRestore();
    stopImmediateSpy.mockRestore();
  });

  it('click is a no-op when disabled (no preventDefault, no propagation stop)', () => {
    // Arrange
    const onPick = vi.fn((_: Element) => undefined);
    const sel = new Selector(onPick);
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    sel.setEnabled(false);

    const stopSpy = vi.spyOn(Event.prototype, 'stopPropagation');
    const stopImmediateSpy = vi.spyOn(
      Event.prototype as unknown as { stopImmediatePropagation: () => void },
      'stopImmediatePropagation',
    );

    // Act
    const ev = click(btn);

    // Assert
    expect(onPick).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
    expect(stopSpy).not.toHaveBeenCalled();
    expect(stopImmediateSpy).not.toHaveBeenCalled();

    // Cleanup
    stopSpy.mockRestore();
    stopImmediateSpy.mockRestore();
  });

  it('confirms selection on pointerdown with default prevented and propagation stopped', () => {
    const onPick = vi.fn((_: Element) => undefined);
    const sel = new Selector(onPick);
    const btn = document.createElement('button');
    document.body.appendChild(btn);

    sel.setEnabled(true);

    // Spy on Event.prototype to see stopPropagation calls
    const stopSpy = vi.spyOn(Event.prototype, 'stopPropagation');

    // Act
    const ev = pointerdown(btn);

    // Assert
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(btn);
    expect(ev.defaultPrevented).toBe(true);
    expect(stopSpy).toHaveBeenCalled();

    sel.setEnabled(false);
    stopSpy.mockRestore();
  });

  it('ignores pointerdown while disabled (no onPick, no preventDefault)', () => {
    // Arrange
    const onPick = vi.fn((_: Element) => undefined);
    const sel = new Selector(onPick);
    const btn = document.createElement('button');
    document.body.appendChild(btn);

    sel.setEnabled(false);

    // Act
    const ev = pointerdown(btn);

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
    pointerdown(btn);
    pointerdown(btn);

    // Assert
    expect(onPick).toHaveBeenCalledTimes(2);
    sel.setEnabled(false);
  });

  it('temporarily enables a disabled button on hover and restores on pointerdown', () => {
    // Arrange
    const onPick = vi.fn((_: Element) => undefined);
    const sel = new Selector(onPick);
    const btn = document.createElement('button');
    btn.disabled = true;
    document.body.appendChild(btn);

    sel.setEnabled(true);

    // Act
    mouseover(btn);

    // Assert: while hovered, it should be enabled and aria-disabled="true", pointer-events:auto
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect((btn as HTMLElement).style.pointerEvents).toBe('auto');

    // Act
    const ev = pointerdown(btn);

    // Assert
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(btn);
    expect(ev.defaultPrevented).toBe(true);
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-disabled')).toBeNull();
    expect((btn as HTMLElement).style.pointerEvents).toBe('');

    sel.setEnabled(false);
  });

  it('switching hover between disabled controls restores previous and enables current', () => {
    // Arrange
    const sel = new Selector(() => undefined);
    const a = document.createElement('button');
    const b = document.createElement('input');
    a.disabled = true;
    (b as HTMLInputElement).disabled = true;
    document.body.append(a, b);

    sel.setEnabled(true);

    // Act1: hover A → A enabled, B untouched
    mouseover(a);
    expect(a.disabled).toBe(false);
    expect(a.getAttribute('aria-disabled')).toBe('true');

    // Act2: move to B → A restored, B enabled
    mouseover(b);
    expect(a.disabled).toBe(true);
    expect(a.getAttribute('aria-disabled')).toBeNull();
    expect(b.disabled).toBe(false);
    expect(b.getAttribute('aria-disabled')).toBe('true');

    sel.setEnabled(false);
  });

  it('cleanup runs on disable(): hovered disabled control returns to original state', () => {
    // Arrange
    const sel = new Selector(() => undefined);
    const btn = document.createElement('button');
    btn.disabled = true;
    document.body.appendChild(btn);

    sel.setEnabled(true);
    mouseover(btn);

    // Preconditions
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute('aria-disabled')).toBe('true');

    // Act
    sel.setEnabled(false);

    // Assert
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-disabled')).toBeNull();
    expect((btn as HTMLElement).style.pointerEvents).toBe('');
  });

  it('restores pre-existing aria-disabled value after pointerdown', () => {
    // Arrange
    const onPick = vi.fn((_: Element) => undefined);
    const sel = new Selector(onPick);
    const btn = document.createElement('button');
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'foo');
    document.body.appendChild(btn);

    sel.setEnabled(true);

    // Act
    mouseover(btn);
    expect(btn.getAttribute('aria-disabled')).toBe('true');

    pointerdown(btn);

    // Assert
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-disabled')).toBe('foo');

    sel.setEnabled(false);
  });

  it('does nothing for non-disabled elements and non-controls on hover', () => {
    // Arrange
    const sel = new Selector(() => undefined);
    const div = document.createElement('div'); // non-control
    const btn = document.createElement('button'); // control but not disabled
    document.body.append(div, btn);

    sel.setEnabled(true);

    // Act
    mouseover(div);
    expect((div as unknown as { disabled?: boolean }).disabled).toBeUndefined();

    mouseover(btn);
    expect(btn.disabled).toBe(false); // remains unchanged
    expect(btn.getAttribute('aria-disabled')).toBeNull();
    expect(btn.style.pointerEvents).toBe('');

    sel.setEnabled(false);
  });
});
