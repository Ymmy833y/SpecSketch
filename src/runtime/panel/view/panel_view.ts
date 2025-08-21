import i18n from '@common/i18n';
import {
  isItemColor,
  isItemShape,
  type ItemColor,
  type ItemShape,
  type ScreenItem,
} from '@common/types';
import type { CaptureArea, CaptureFormat } from '@panel/services/capture';
import { getStatusMessage, STATUS, STATUS_LABEL_STYLE, type StatusKey } from '@panel/view/status';

import type { Model } from '../app/model';
import { type UIEventPayloadMap, UIEventType } from '../types/ui_event_types';

const STATUS_BASE_BODY = [
  'inline-flex',
  'items-center',
  'gap-1',
  'rounded-full',
  'border',
  'px-2',
  'py-1',
  'text-xs',
  'transition-colors',
] as const;
const TOGGLE_ICON_BASE = ['inline-block', 'w-3', 'h-3', 'rounded-full'] as const;
const CAPTURE_OPTION_COLLAPSED = '▼';
const CAPTURE_OPTION_EXPANDED = '▲';

function byLabelThenId(a: { label: number; id: number }, b: { label: number; id: number }) {
  if (a.label !== b.label) return a.label - b.label;
  return a.id - b.id;
}

export class PanelView {
  private listeners: { [K in UIEventType]?: unknown[] } = {};

  private els!: {
    status: HTMLSpanElement;
    toggleBtn: HTMLButtonElement;
    toggleIcon: HTMLSpanElement;
    toggleLabel: HTMLSpanElement;
    clearBtn: HTMLButtonElement;
    captureBtn: HTMLButtonElement;

    list: HTMLUListElement;
    empty: HTMLDivElement;
    count: HTMLSpanElement;

    captureOptionsToggle: HTMLButtonElement;
    captureOptionsPanel: HTMLElement;
    captureFmtRadios: NodeListOf<HTMLInputElement>;
    captureAreaRadios: NodeListOf<HTMLInputElement>;
    jpegOnlyEls: NodeListOf<HTMLElement>;
    jpegQualityRange: HTMLInputElement;
    jpegQualityNumber: HTMLInputElement;
    captureScaleRange: HTMLInputElement;
    captureScaleNumber: HTMLInputElement;

    badgeSizeRange: HTMLInputElement;
    badgeSizeNumber: HTMLInputElement;
    badgeColorButtons: NodeListOf<HTMLButtonElement>;
    badgeColorLabel: HTMLSpanElement;
    badgeColorDot: HTMLSpanElement;
    badgeShapeSelect: HTMLSelectElement;
  };

  private dragEl: HTMLLIElement | null = null;
  private dragStartIndex = -1;

  constructor(private doc: Document) {
    i18n.localize(doc);

    this.els = {
      status: this.$('#status'),
      toggleBtn: this.$('#toggle-select'),
      toggleIcon: this.$('#toggle-select-icon'),
      toggleLabel: this.$('#toggle-select-label'),
      clearBtn: this.$('#clear'),
      captureBtn: this.$('#capture'),

      list: this.$('#select-list'),
      empty: this.$('#select-empty'),
      count: this.$('#select-count'),

      captureOptionsToggle: this.$('#capture-options-toggle'),
      captureOptionsPanel: this.$('#capture-options'),
      captureFmtRadios: this.$all<HTMLInputElement>('input[name="capture-format"]'),
      captureAreaRadios: this.$all<HTMLInputElement>('input[name="capture-area"]'),
      jpegOnlyEls: this.$all<HTMLElement>('.jpeg-only'),
      jpegQualityRange: this.$('#jpeg-quality-range'),
      jpegQualityNumber: this.$('#jpeg-quality-number'),
      captureScaleRange: this.$('#capture-scale-range'),
      captureScaleNumber: this.$('#capture-scale-number'),

      badgeSizeRange: this.$('#badge-size-range'),
      badgeSizeNumber: this.$('#badge-size-number'),
      badgeColorButtons: this.$all<HTMLButtonElement>('#badge-color-pop button'),
      badgeColorLabel: this.$('#badge-color-label'),
      badgeColorDot: this.$('#badge-color-dot'),
      badgeShapeSelect: this.$('#badge-shape-select'),
    };

    this.els.toggleBtn.addEventListener('click', () =>
      this.emit(UIEventType.TOGGLE_SELECT, undefined),
    );
    this.els.clearBtn.addEventListener('click', () => this.emit(UIEventType.CLEAR, undefined));
    this.els.captureBtn.addEventListener('click', () => this.emit(UIEventType.CAPTURE, undefined));

    // === Capture options ===
    this.els.captureOptionsToggle.addEventListener('click', () => {
      this.emit(UIEventType.TOGGLE_CAPTURE_PANEL, undefined);
    });

    this.els.captureFmtRadios.forEach((r) =>
      r.addEventListener('change', () => {
        this.updateQualityVisibility();
        this.emit(UIEventType.CAPTURE_FORMAT_CHANGE, { format: this.getSelectedCaptureFormat() });
      }),
    );
    this.els.captureAreaRadios.forEach((r) =>
      r.addEventListener('change', () => {
        this.emit(UIEventType.CAPTURE_AREA_CHANGE, { area: this.getSelectedCaptureArea() });
      }),
    );

    this.bindSync(this.els.jpegQualityRange, this.els.jpegQualityNumber, (v) =>
      this.emit(UIEventType.CAPTURE_QUALITY_CHANGE, { quality: v }),
    );
    this.bindSync(this.els.captureScaleRange, this.els.captureScaleNumber, (v) =>
      this.emit(UIEventType.CAPTURE_SCALE_CHANGE, { scale: v }),
    );

    // === Badge ===
    this.bindSync(this.els.badgeSizeRange, this.els.badgeSizeNumber);
    const fireSize = () => {
      const v = Number(this.els.badgeSizeNumber.value);
      if (Number.isFinite(v)) this.emit(UIEventType.BADGE_SIZE_CHANGE, { size: v });
    };
    this.els.badgeSizeRange.addEventListener('change', fireSize);
    this.els.badgeSizeNumber.addEventListener('change', fireSize);

    this.els.badgeColorButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const raw = btn.dataset.colorName ?? '';
        const color = isItemColor(raw) ? (raw as ItemColor) : 'Blue';
        this.emit(UIEventType.BADGE_COLOR_SELECT, { color });
      });
    });

    this.els.badgeShapeSelect.addEventListener('change', () => {
      const v = this.els.badgeShapeSelect.value ?? null;
      const shape = isItemShape(v) ? (v as ItemShape) : 'circle';
      this.emit(UIEventType.BADGE_SHAPE_CHANGE, { shape });
    });

    this.els.list.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!this.dragEl) return;

      const targetLi = (e.target as HTMLElement)?.closest('li') as HTMLLIElement | null;
      if (targetLi && targetLi !== this.dragEl) {
        const rect = targetLi.getBoundingClientRect();
        const isAfter = e.clientY - rect.top > rect.height / 2;
        this.els.list.insertBefore(this.dragEl, isAfter ? targetLi.nextSibling : targetLi);
      } else if (!targetLi) {
        this.els.list.appendChild(this.dragEl);
      }
    });
    this.els.list.addEventListener('drop', (e) => e.preventDefault());

    this.updateQualityVisibility();
  }

  on<K extends UIEventType>(type: K, handler: (e: UIEventPayloadMap[K]) => void): void {
    const arr = (this.listeners[type] ??= []) as Array<(e: UIEventPayloadMap[K]) => void>;
    arr.push(handler);
  }

  private emit<K extends UIEventType>(type: K, e: UIEventPayloadMap[K]): void {
    const arr = this.listeners[type] as Array<(x: UIEventPayloadMap[K]) => void> | undefined;
    arr?.forEach((h) => h(e));
  }

  render(model: Model): void {
    this.renderStatus(model.status);
    this.renderToggle(model.selectionEnabled);
    this.renderList(model.items);

    this.selectRadioByValue(this.els.captureFmtRadios, model.capture.format);
    this.selectRadioByValue(this.els.captureAreaRadios, model.capture.area);
    this.els.jpegQualityNumber.value = String(model.capture.quality);
    this.els.jpegQualityRange.value = String(model.capture.quality);
    this.els.captureScaleNumber.value = String(model.capture.scale);
    this.els.captureScaleRange.value = String(model.capture.scale);
    this.updateQualityVisibility(model.capture.format);

    const expanded = model.capture.panelExpanded;
    this.els.captureOptionsToggle.setAttribute('aria-expanded', String(expanded));
    this.els.captureOptionsToggle.textContent = expanded
      ? CAPTURE_OPTION_EXPANDED
      : CAPTURE_OPTION_COLLAPSED;
    this.els.captureOptionsPanel.classList.toggle('hidden', !expanded);

    this.els.badgeSizeNumber.value = String(model.defaultSize);
    this.els.badgeSizeRange.value = String(model.defaultSize);
    this.applyBadgeColorUI(model.defaultColor);
    this.els.badgeShapeSelect.value = model.defaultShape;
  }

  private renderStatus(key: StatusKey): void {
    const style = STATUS_LABEL_STYLE[key];
    const el = this.els.status;
    el.className = '';
    el.classList.add(...STATUS_BASE_BODY, ...style.body);

    const dot = this.doc.createElement('span');
    dot.classList.add('h-1.5', 'w-1.5', 'rounded-full', ...style.dot);

    const text = this.doc.createElement('span');
    text.textContent = getStatusMessage(key);
    el.replaceChildren(dot, text);

    this.disabledAllButtons(key !== STATUS.CONNECTED);
  }

  private renderToggle(enabled: boolean): void {
    const icon = this.els.toggleIcon;
    icon.className = '';
    icon.classList.add(...TOGGLE_ICON_BASE, enabled ? 'bg-emerald-500' : 'bg-slate-300');
    this.els.toggleLabel.textContent = i18n.get(enabled ? 'toggle_on' : 'toggle_off');
  }

  private renderList(items: ScreenItem[]): void {
    this.els.count.textContent = String(items.length);
    if (!items.length) {
      this.els.empty.classList.remove('hidden');
      this.els.list.replaceChildren();
      return;
    }
    this.els.empty.classList.add('hidden');

    const frag = this.doc.createDocumentFragment();
    for (const it of items.sort(byLabelThenId)) {
      const li = this.doc.createElement('li');
      li.className =
        'group flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60';
      li.dataset.id = String(it.id);
      li.draggable = true;

      // Drag origin retention & light visual feedback
      li.addEventListener('dragstart', (e) => {
        this.dragEl = li;
        this.dragStartIndex = Array.prototype.indexOf.call(this.els.list.children, li);
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
        }
        li.classList.add('opacity-60');
      });

      // Clean up & fire an action if anything changes
      li.addEventListener('dragend', () => {
        if (!this.dragEl) return;
        const endIndex = Array.prototype.indexOf.call(this.els.list.children, this.dragEl);
        this.dragEl.classList.remove('opacity-60');

        const fromId = this.dragEl.dataset.id ?? '';
        this.dragEl = null;

        if (
          fromId &&
          this.dragStartIndex >= 0 &&
          endIndex >= 0 &&
          endIndex !== this.dragStartIndex
        ) {
          this.emit(UIEventType.REORDER_ITEMS, {
            fromId: Number(fromId),
            toIndex: endIndex,
          });
        }

        this.dragStartIndex = -1;
      });

      const badge = this.doc.createElement('span');
      badge.className =
        'inline-flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 text-xs font-semibold';
      badge.textContent = String(it.label);

      const main = this.doc.createElement('div');
      main.className = 'min-w-0 flex-1';

      const line1 = this.doc.createElement('div');
      line1.className = 'text-sm font-medium truncate';
      line1.textContent = it.anchor.value;

      main.append(line1);
      li.append(badge, main);
      frag.appendChild(li);
    }
    this.els.list.replaceChildren(frag);
  }

  private getSelectedCaptureFormat(): CaptureFormat {
    const val = this.doc.querySelector<HTMLInputElement>(
      'input[name="capture-format"]:checked',
    )?.value;
    return val === 'jpeg' ? 'jpeg' : 'png';
  }
  private getSelectedCaptureArea(): CaptureArea {
    const val = this.doc.querySelector<HTMLInputElement>(
      'input[name="capture-area"]:checked',
    )?.value;
    return val === 'viewport' ? 'viewport' : 'full';
  }
  private updateQualityVisibility(format?: CaptureFormat): void {
    const f = format ?? this.getSelectedCaptureFormat();
    const isJpeg = f === 'jpeg';
    this.els.jpegOnlyEls.forEach((el) => el.classList.toggle('hidden', !isJpeg));
    this.els.jpegQualityRange.disabled = !isJpeg;
    this.els.jpegQualityNumber.disabled = !isJpeg;
  }
  private selectRadioByValue(radios: NodeListOf<HTMLInputElement>, value: string): void {
    radios.forEach((r) => (r.checked = r.value === value));
  }
  private bindSync(
    rangeEl: HTMLInputElement,
    numberEl: HTMLInputElement,
    onValue?: (val: number) => void,
  ): void {
    const readNum = (s: string | null | undefined, fallback: number): number => {
      const v = s != null && s !== '' ? Number(s) : NaN;
      return Number.isFinite(v) ? v : fallback;
    };
    const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

    const sync = (rawStr: string) => {
      const min = readNum(numberEl.min || rangeEl.min, Number.NEGATIVE_INFINITY);
      const max = readNum(numberEl.max || rangeEl.max, Number.POSITIVE_INFINITY);
      const step = readNum(numberEl.step || rangeEl.step, 1);
      const raw = Number(rawStr);
      const clamped = clamp(Number.isFinite(raw) ? raw : 0, min, max);
      const rounded = Math.round(clamped / step) * step;
      const fixed = Number(rounded.toFixed(6));
      numberEl.value = String(fixed);
      rangeEl.value = String(fixed);
      onValue?.(fixed);
    };

    rangeEl.addEventListener('input', () => sync(rangeEl.value));
    numberEl.addEventListener('input', () => sync(numberEl.value));
  }
  private disabledAllButtons(isDisabled: boolean): void {
    this.doc.querySelectorAll('button').forEach((btn) => (btn.disabled = isDisabled));
  }
  private getBadgeColorStyleName(color: ItemColor): string {
    const colorName = color === 'Gray' ? 'slate' : color;
    return `bg-${colorName.toLowerCase()}-500`;
  }
  private applyBadgeColorUI(color: ItemColor): void {
    this.els.badgeColorButtons.forEach((button) => {
      const selected = button.dataset.colorName === color;
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    this.els.badgeColorLabel.textContent = color;
    this.els.badgeColorDot.className = 'inline-block w-4 h-4 rounded-full';
    this.els.badgeColorDot.classList.add(this.getBadgeColorStyleName(color));
  }

  private $<T extends Element>(selector: string): T {
    const el = this.doc.querySelector(selector);
    if (!el) throw new Error(`[PanelView] Missing element: ${selector}`);
    return el as T;
  }
  private $all<T extends Element>(selector: string): NodeListOf<T> {
    return this.doc.querySelectorAll<T>(selector);
  }
}
