export class Selector {
  private enabled = false;
  private onPick: (el: Element) => void;
  private onClick = (ev: MouseEvent) => this.handleClick(ev);
  private onMouseOver = (ev: MouseEvent) => this.highlight(ev);

  private hoverBox: HTMLDivElement | null = null;

  constructor(onPick: Selector['onPick']) {
    this.onPick = onPick;
  }

  setEnabled(v: boolean) {
    if (v === this.enabled) return;
    this.enabled = v;
    if (v) {
      document.addEventListener('click', this.onClick, true);
      document.addEventListener('mouseover', this.onMouseOver, true);
    } else {
      document.removeEventListener('click', this.onClick, true);
      document.removeEventListener('mouseover', this.onMouseOver, true);
      this.removeHover();
    }
  }

  private handleClick(ev: MouseEvent) {
    if (!this.enabled) return;
    ev.preventDefault();
    ev.stopPropagation();

    const el = ev.target as Element | null;
    if (!el || el.nodeType !== 1) return;

    this.onPick(el);
  }

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

  private ensureHover() {
    if (this.hoverBox) return;
    this.hoverBox = document.createElement('div');
    Object.assign(this.hoverBox.style, {
      position: 'absolute',
      outline: '2px dashed #00a',
      pointerEvents: 'none',
      zIndex: '2147483647'
    } as CSSStyleDeclaration);
    document.body.appendChild(this.hoverBox);
  }

  private removeHover() {
    this.hoverBox?.remove();
    this.hoverBox = null;
  }
}
