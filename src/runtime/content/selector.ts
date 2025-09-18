/**
 * A simple element selector that highlights elements on mouseover
 * and confirms selection on click.
 *
 * @remarks
 * - Registers capture-phase listeners when enabled.
 * - The highlight box is absolutely positioned on `document.body`.
 */
export class Selector {
  private enabled = false;
  private onPick: (el: Element) => void;
  private onClick = (ev: MouseEvent) => this.handleClick(ev);
  private onPointerDown = (ev: PointerEvent) => this.handlePointerDown(ev);
  private onMouseOver = (ev: MouseEvent) => this.highlight(ev);

  private hoverBox: HTMLDivElement | null = null;

  private cleanupTemp?: () => void;
  private lastHoverEl?: Element | null;

  /**
   * Creates a selector with a callback invoked on selection confirmation.
   * @param onPick - Invoked when a click confirms an element
   */
  constructor(onPick: Selector['onPick']) {
    this.onPick = onPick;
  }

  /**
   * Enables or disables the selector.
   * Starts/stops event subscriptions and removes the highlight on disable.
   *
   * @param enabled - True to enable; false to disable
   */
  setEnabled(enabled: boolean) {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (enabled) {
      document.addEventListener('click', this.onClick, true);
      document.addEventListener('pointerdown', this.onPointerDown, true);
      document.addEventListener('mouseover', this.onMouseOver, true);
    } else {
      document.removeEventListener('click', this.onClick, true);
      document.removeEventListener('pointerdown', this.onPointerDown, true);
      document.removeEventListener('mouseover', this.onMouseOver, true);
      this.cleanupTemp?.();
      this.lastHoverEl = null;
      this.removeHover();
    }
  }

  /**
   * Click handler that prevents default behavior, stops propagation,
   * and ensures no further listeners are invoked.
   *
   * @param ev - Click event
   */
  private handleClick(ev: MouseEvent) {
    if (!this.enabled) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation?.();
  }

  /**
   * Pointer down handler that prevents default behavior and forwards the element to `onPick`.
   *
   * @param ev - Pointer event
   */
  private handlePointerDown(ev: PointerEvent) {
    if (!this.enabled) return;
    if (ev.button !== 0 || !ev.isPrimary) return;

    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation?.();

    const el = ev.target as Element | null;
    if (!el || el.nodeType !== 1) return;

    this.onPick(el);
    this.cleanupTemp?.();
  }

  /**
   * Mouseover handler that repositions the highlight box to the hovered element.
   *
   * @param ev - Mouseover event
   */
  private highlight(ev: MouseEvent) {
    if (!this.enabled) return;
    const el = ev.target as Element | null;
    if (!el || el.nodeType !== 1) return;

    const rect = el.getBoundingClientRect();
    this.ensureHover();
    const box = this.hoverBox!;
    box.style.left = `${rect.left + window.scrollX}px`;
    box.style.top = `${rect.top + window.scrollY}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;

    if (this.lastHoverEl !== el) {
      this.cleanupTemp?.();
      this.cleanupTemp = this.tempEnableIfDisabled(el);
      this.lastHoverEl = el;
    }
  }

  /**
   * Temporarily enables a disabled form control (`<button>`, `<input>`, `<select>`, `<textarea>`)
   * to allow pointer and click events.
   *
   * @param el - Target element; ignored if not a disabled form control.
   * @returns A cleanup callback that restores its original state (no-op if unchanged).
   */
  private tempEnableIfDisabled(el: Element) {
    const ctrl = el as HTMLElement;
    if (!('disabled' in ctrl)) return () => {};
    if (!ctrl.disabled) return () => {};

    const prev = {
      disabled: ctrl.disabled,
      aria: ctrl.getAttribute('aria-disabled'),
      pe: ctrl.style.pointerEvents,
    };

    // Temporarily enabled (semantics maintained in aria)
    ctrl.disabled = false;
    ctrl.setAttribute('aria-disabled', 'true');
    ctrl.style.pointerEvents = 'auto';

    // Restoration Closure
    return () => {
      ctrl.disabled = prev.disabled;
      if (prev.aria === null) {
        ctrl.removeAttribute('aria-disabled');
      } else {
        ctrl.setAttribute('aria-disabled', prev.aria);
      }
      ctrl.style.pointerEvents = prev.pe;
    };
  }

  /**
   * Lazily creates the highlight box when needed.
   */
  private ensureHover() {
    if (this.hoverBox) return;
    this.hoverBox = document.createElement('div');
    Object.assign(this.hoverBox.style, {
      position: 'absolute',
      outline: '3px dashed rgba(99, 102, 241, 1)',
      background: 'rgba(99, 102, 241, 0.3)',
      pointerEvents: 'none',
      zIndex: '2147483647',
    } as CSSStyleDeclaration);
    document.body.appendChild(this.hoverBox);
  }

  /**
   * Removes the highlight box from the DOM.
   */
  private removeHover() {
    this.hoverBox?.remove();
    this.hoverBox = null;
  }
}
