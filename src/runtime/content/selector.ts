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
  private onMouseOver = (ev: MouseEvent) => this.highlight(ev);

  private hoverBox: HTMLDivElement | null = null;

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
      document.addEventListener('mouseover', this.onMouseOver, true);
    } else {
      document.removeEventListener('click', this.onClick, true);
      document.removeEventListener('mouseover', this.onMouseOver, true);
      this.removeHover();
    }
  }

  /**
   * Click handler that prevents default behavior and forwards the element to `onPick`.
   *
   * @param ev - Click event
   * @internal
   */
  private handleClick(ev: MouseEvent) {
    if (!this.enabled) return;
    ev.preventDefault();
    ev.stopPropagation();

    const el = ev.target as Element | null;
    if (!el || el.nodeType !== 1) return;

    this.onPick(el);
  }

  /**
   * Mouseover handler that repositions the highlight box to the hovered element.
   *
   * @param ev - Mouseover event
   * @internal
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
  }

  /**
   * Lazily creates the highlight box when needed.
   * @internal
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
   * @internal
   */
  private removeHover() {
    this.hoverBox?.remove();
    this.hoverBox = null;
  }
}
